const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const port = 18787 + Math.floor(Math.random() * 500);
const dataFile = path.join(os.tmpdir(), `xiaorili-sync-${process.pid}.json`);
let server;
const request = async (url, options) => {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, options);
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
};

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "..", "sync-server.cjs")], {
    env: { ...process.env, PORT: String(port), SYNC_DATA_FILE: dataFile },
    env: { ...process.env, PORT: String(port), SYNC_DATA_FILE: dataFile, SMS_RESEND_SECONDS: "0" },
    stdio: "ignore",
  });
  for (let i = 0; i < 30; i += 1) {
    try { await request("/health"); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("sync server did not start");
});

test.after(() => {
  server?.kill();
  try { fs.unlinkSync(dataFile); } catch {}
});

test("reports protocol compatibility", async () => {
  const { response, data } = await request("/app/version");
  assert.equal(response.status, 200);
  assert.equal(data.protocolVersion, 1);
  assert.ok(data.minClientVersion);
  assert.ok(data.features.includes("clipboard-image-import"));
  assert.ok(data.features.includes("sms-login"));
});

test("allows browser CORS preflight", async () => {
  const { response } = await request("/sync", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:4173",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type, authorization",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("access-control-allow-methods") || "", /PUT/);
});

test("registers, authenticates, and syncs data", async () => {
  const email = `test-${Date.now()}@example.com`;
  const { response: registerResponse, data: register } = await request("/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  assert.equal(registerResponse.status, 200);
  assert.ok(register.token);
  const snapshot = { protocolVersion: 1, tasks: [{ id: 1, title: "test" }] };
  const { response: putResponse, data: put } = await request("/sync", {
    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${register.token}` },
    body: JSON.stringify(snapshot),
  });
  assert.equal(putResponse.status, 200);
  assert.deepEqual(put.data.tasks, snapshot.tasks);
  const { response: getResponse, data: get } = await request("/sync", {
    headers: { Authorization: `Bearer ${register.token}` },
  });
  assert.equal(getResponse.status, 200);
  assert.deepEqual(get.data.tasks, snapshot.tasks);
});

test("concurrent logins keep every device token valid", async () => {
  const email = `multi-${Date.now()}@example.com`;
  const password = "password123";
  const { response: registerResponse } = await request("/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(registerResponse.status, 200);
  const login = () => request("/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const [first, second] = await Promise.all([login(), login()]);
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  const tokens = [first.data.token, second.data.token];
  for (const token of tokens) {
    const get = await request("/sync", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(get.response.status, 200, "login token must stay valid");
    const put = await request("/sync", {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ protocolVersion: 1, tasks: [{ id: 1, title: "multi-device" }] }),
    });
    assert.equal(put.response.status, 200, "login token must accept sync");
  }
  const final = await request("/sync", { headers: { Authorization: `Bearer ${tokens[0]}` } });
  assert.equal(final.response.status, 200);
  assert.deepEqual(final.data.data.tasks, [{ id: 1, title: "multi-device" }]);
});

test("rejects unauthenticated sync", async () => {
  const { response } = await request("/sync");
  assert.equal(response.status, 401);
});

test("email login with unknown account returns account-missing message", async () => {
  const { response, data } = await request("/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `missing-${Date.now()}@example.com`, password: "password123" }),
  });
  assert.equal(response.status, 404);
  assert.match(data.message, /账户不存在/);
});

test("sms dev code registers, logs in on multiple devices, and syncs", async () => {
  const phone = `138${String(Date.now()).slice(-8)}`;
  const send = (mode) => request("/auth/sms/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, mode }),
  });
  const firstSend = await send("register");
  assert.equal(firstSend.response.status, 200);
  assert.match(firstSend.data.devCode, /^\d{6}$/);
  const firstVerify = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: firstSend.data.devCode, mode: "register" }),
  });
  assert.equal(firstVerify.response.status, 200);
  assert.ok(firstVerify.data.token);
  const secondSend = await send("login");
  assert.equal(secondSend.response.status, 200);
  const secondVerify = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: secondSend.data.devCode, mode: "login" }),
  });
  assert.equal(secondVerify.response.status, 200);
  const tokens = [firstVerify.data.token, secondVerify.data.token];
  for (const token of tokens) {
    const put = await request("/sync", {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ protocolVersion: 1, tasks: [{ id: 1, title: "sms-device" }] }),
    });
    assert.equal(put.response.status, 200);
    const get = await request("/sync", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(get.response.status, 200);
    assert.deepEqual(get.data.data.tasks, [{ id: 1, title: "sms-device" }]);
  }
});

test("sms rejects wrong code and missing login account", async () => {
  const phone = `139${String(Date.now()).slice(-8)}`;
  const send = await request("/auth/sms/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, mode: "login" }),
  });
  assert.equal(send.response.status, 200);
  const wrong = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: "000000", mode: "login" }),
  });
  assert.equal(wrong.response.status, 401);
  assert.match(wrong.data.message, /验证码错误/);
  const missing = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: send.data.devCode, mode: "login" }),
  });
  assert.equal(missing.response.status, 404);
  assert.match(missing.data.message, /手机号未注册/);
});

test("sms register rejects duplicate phone", async () => {
  const phone = `137${String(Date.now()).slice(-8)}`;
  const send = (mode) => request("/auth/sms/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, mode }),
  });
  const first = await send("register");
  const firstVerify = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: first.data.devCode, mode: "register" }),
  });
  assert.equal(firstVerify.response.status, 200);
  const second = await send("register");
  const secondVerify = await request("/auth/sms/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: second.data.devCode, mode: "register" }),
  });
  assert.equal(secondVerify.response.status, 409);
  assert.match(secondVerify.data.message, /已注册/);
});

test("sms send fails clearly when dev mode disabled without provider", async () => {
  const port = 19787 + Math.floor(Math.random() * 500);
  const dataFile = path.join(os.tmpdir(), `xiaorili-sms-off-${process.pid}.json`);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "sync-server.cjs")], {
    env: { ...process.env, PORT: String(port), SYNC_DATA_FILE: dataFile, SMS_DEV_MODE: "false" },
    stdio: "ignore",
  });
  try {
    let ready = false;
    for (let i = 0; i < 30; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, "secondary server did not start");
    const response = await fetch(`http://127.0.0.1:${port}/auth/sms/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "13800000001", mode: "login" }),
    });
    const data = await response.json();
    assert.equal(response.status, 500);
    assert.match(data.message, /短信服务未配置/);
    assert.equal(data.devCode, undefined);
  } finally {
    child.kill();
    try { fs.unlinkSync(dataFile); } catch {}
  }
});
