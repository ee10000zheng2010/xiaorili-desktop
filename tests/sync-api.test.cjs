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

test("rejects unauthenticated sync", async () => {
  const { response } = await request("/sync");
  assert.equal(response.status, 401);
});
