const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 8787);
const protocolVersion = 1;
const appVersion = process.env.APP_VERSION || "0.2.0";
const file = process.env.SYNC_DATA_FILE || path.join(process.cwd(), "sync-data.json");
const readDb = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { users: {} }; } };
const writeDb = (db) => fs.writeFileSync(file, JSON.stringify(db, null, 2));
const hash = (password, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, digest: crypto.scryptSync(password, salt, 64).toString("hex") });
const token = (email) => Buffer.from(`${email}:${crypto.randomBytes(24).toString("hex")}`).toString("base64url");
const tokensFor = (user) => Array.isArray(user.tokens) ? user.tokens : (user.token ? [user.token] : []);
const resetCode = () => String(crypto.randomInt(100000, 1000000));
const smsCodes = new Map();
const smsResendSeconds = Number(process.env.SMS_RESEND_SECONDS || 60);
const devSms = process.env.SMS_DEV_MODE !== "false";
const normalizePhone = (phone) => {
  const digits = String(phone || "").trim().replace(/[\s-]/g, "");
  const normalized = /^1[3-9]\d{9}$/.test(digits) ? `+86${digits}` : digits;
  return /^\+?\d{6,15}$/.test(normalized) ? normalized : "";
};
const smsProvider = process.env.SMS_PROVIDER || "";
const aliyunSms = {
  accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || "",
  accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || "",
  signName: process.env.ALIYUN_SMS_SIGN_NAME || "",
  templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || "",
};
const percentEncode = (value) => encodeURIComponent(String(value)).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
const sendSms = async (phone, code) => {
  if (devSms) return { ok: true, devCode: code };
  if (smsProvider !== "aliyun") throw new Error("短信服务未配置：请设置 SMS_PROVIDER 和对应凭证");
  const params = {
    AccessKeyId: aliyunSms.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: "cn-hangzhou",
    SignName: aliyunSms.signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: aliyunSms.templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };
  if (!params.AccessKeyId || !aliyunSms.accessKeySecret || !params.SignName || !params.TemplateCode) throw new Error("短信服务配置不完整：请检查阿里云短信凭证");
  const canonical = Object.keys(params).sort().map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`).join("&");
  params.Signature = crypto.createHmac("sha1", `${aliyunSms.accessKeySecret}&`).update(`POST&${percentEncode("/")}&${percentEncode(canonical)}`).digest("base64");
  const query = Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
  const response = await fetch(`https://dysmsapi.aliyuncs.com/?${query}`, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.Code !== "OK") throw new Error(data.Message || "短信发送失败");
  return { ok: true };
};
const body = (req) => new Promise((resolve, reject) => { let raw = ""; req.on("data", (chunk) => { raw += chunk; if (raw.length > 2e6) reject(new Error("payload too large")); }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid json")); } }); });
const send = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Max-Age": "86400" }); res.end(JSON.stringify(data)); };

let dbQueue = Promise.resolve();
const serialized = (task) => {
  const run = dbQueue.then(task, task);
  dbQueue = run.catch(() => {});
  return run;
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.url === "/health" && req.method === "GET") return send(res, 200, { ok: true });
  if (req.url === "/app/version" && req.method === "GET") return send(res, 200, {
    version: appVersion,
    protocolVersion,
    minClientVersion: process.env.MIN_CLIENT_VERSION || "0.1.0",
    features: ["account-sync", "clipboard-image-import"],
    features: ["account-sync", "clipboard-image-import", "sms-login"],
  });
  serialized(async () => {
    try {
      const db = readDb();
      if (/^\/auth\/(login|register)$/.test(req.url) && req.method === "POST") {
        const mode = req.url.endsWith("register") ? "register" : "login";
        const { email, password } = await body(req); const normalized = String(email || "").trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(normalized) || String(password || "").length < 6) return send(res, 400, { message: "请输入有效邮箱和至少 6 位密码" });
        const existing = db.users[normalized];
        if (mode === "register" && existing) return send(res, 409, { message: "账户已存在" });
        if (mode === "login" && !existing) return send(res, 404, { message: "账户不存在，请先注册" });
        if (mode === "login" && existing.digest !== hash(password, existing.salt).digest) return send(res, 401, { message: "邮箱或密码错误" });
        const credentials = mode === "register" ? hash(password) : existing;
        const nextToken = token(normalized);
        db.users[normalized] = {
          ...credentials,
          tokens: mode === "register" ? [nextToken] : [...tokensFor(existing), nextToken],
          data: existing?.data || null,
        };
        delete db.users[normalized].token;
        writeDb(db);
        return send(res, 200, { token: nextToken });
      }
      if (req.url === "/auth/sms/send" && req.method === "POST") {
        const { phone, mode } = await body(req);
        const normalized = normalizePhone(phone);
        if (!normalized || !["login", "register"].includes(mode)) return send(res, 400, { message: "请输入有效手机号，并指定 login 或 register" });
        const last = smsCodes.get(normalized);
        if (last && Date.now() - (last.lastSentAt || 0) < smsResendSeconds * 1000) return send(res, 429, { message: `请 ${smsResendSeconds} 秒后再获取验证码` });
        const code = resetCode();
        const result = await sendSms(normalized, code);
        smsCodes.set(normalized, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, lastSentAt: Date.now(), mode });
        const payload = { message: mode === "register" ? "验证码已发送，注册后将自动创建账户" : "验证码已发送，请尽快输入", expiresInSeconds: 300 };
        if (result.devCode) payload.devCode = result.devCode;
        return send(res, 200, payload);
      }
      if (req.url === "/auth/sms/verify" && req.method === "POST") {
        const { phone, code, mode = "login" } = await body(req);
        const normalized = normalizePhone(phone);
        if (!normalized || !String(code || "").trim()) return send(res, 400, { message: "请输入手机号和验证码" });
        const entry = smsCodes.get(normalized);
        if (!entry || entry.expiresAt < Date.now()) return send(res, 401, { message: "验证码已过期，请重新获取" });
        if (entry.attempts >= 5) { smsCodes.delete(normalized); return send(res, 429, { message: "验证码错误次数过多，请重新获取" }); }
        if (entry.code !== String(code).trim()) { entry.attempts += 1; return send(res, 401, { message: "验证码错误，请重新输入" }); }
        const key = `sms:${normalized}`;
        const existing = db.users[key];
        if (mode === "login" && !existing) return send(res, 404, { message: "手机号未注册" });
        if (mode === "register" && existing) return send(res, 409, { message: "该手机号已注册，请直接登录" });
        const nextToken = token(key);
        db.users[key] = {
          phone: normalized,
          tokens: existing ? [...tokensFor(existing), nextToken] : [nextToken],
          data: existing?.data || null,
        };
        delete db.users[key].token;
        smsCodes.delete(normalized);
        writeDb(db);
        return send(res, 200, { token: nextToken });
      }
      if (req.url === "/auth/forgot-password" && req.method === "POST") {
        const { email } = await body(req); const normalized = String(email || "").trim().toLowerCase();
        const existing = db.users[normalized];
        if (!existing) return send(res, 404, { message: "账户不存在" });
        const code = resetCode();
        existing.reset = { digest: hash(code, normalized).digest, expiresAt: Date.now() + 10 * 60 * 1000 };
        writeDb(db);
        return send(res, 200, { message: "重置码已生成，请在 10 分钟内完成重置", resetCode: code });
      }
      if (req.url === "/auth/reset-password" && req.method === "POST") {
        const { email, code, password } = await body(req); const normalized = String(email || "").trim().toLowerCase();
        const existing = db.users[normalized];
        if (!existing || !existing.reset || existing.reset.expiresAt < Date.now() || existing.reset.digest !== hash(String(code || ""), normalized).digest)
          return send(res, 401, { message: "重置码无效或已过期" });
        if (String(password || "").length < 6) return send(res, 400, { message: "新密码至少 6 位" });
        const credentials = hash(password);
        db.users[normalized] = { ...existing, ...credentials, tokens: [], reset: null };
        writeDb(db);
        return send(res, 200, { message: "密码已重置，请使用新密码登录" });
      }
      if (req.url === "/sync" && (req.method === "GET" || req.method === "PUT")) {
        const raw = String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""); const entry = Object.values(db.users).find((user) => tokensFor(user).includes(raw));
        if (!entry) return send(res, 401, { message: "请先登录" });
        if (req.method === "GET") return send(res, 200, { data: entry.data });
        const incoming = await body(req);
        entry.data = { ...incoming, protocolVersion: incoming.protocolVersion || protocolVersion };
        writeDb(db); return send(res, 200, { data: entry.data, protocolVersion });
      }
      send(res, 404, { message: "not found" });
    } catch (error) {
      send(res, 500, { message: error.message || "server error" });
    }
  });
});
server.listen(port, () => console.log(`Xiaorili sync API listening on ${port}`));
