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
const body = (req) => new Promise((resolve, reject) => { let raw = ""; req.on("data", (chunk) => { raw += chunk; if (raw.length > 2e6) reject(new Error("payload too large")); }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid json")); } }); });
const send = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Max-Age": "86400" }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  try {
    const db = readDb();
    if (req.url === "/health" && req.method === "GET") return send(res, 200, { ok: true });
    if (req.url === "/app/version" && req.method === "GET") return send(res, 200, {
      version: appVersion,
      protocolVersion,
      minClientVersion: process.env.MIN_CLIENT_VERSION || "0.1.0",
      features: ["account-sync", "clipboard-image-import"],
    });
    if (/^\/auth\/(login|register)$/.test(req.url) && req.method === "POST") {
      const mode = req.url.endsWith("register") ? "register" : "login";
      const { email, password } = await body(req); const normalized = String(email || "").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalized) || String(password || "").length < 6) return send(res, 400, { message: "请输入有效邮箱和至少 6 位密码" });
      const existing = db.users[normalized];
      if (mode === "register" && existing) return send(res, 409, { message: "账户已存在" });
      if (mode === "login" && (!existing || existing.digest !== hash(password, existing.salt).digest)) return send(res, 401, { message: "邮箱或密码错误" });
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
  } catch (error) { send(res, 500, { message: error.message || "server error" }); }
});
server.listen(port, () => console.log(`Xiaorili sync API listening on ${port}`));
