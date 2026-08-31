const { execFileSync, spawnSync } = require("node:child_process");

const repo = "ee10000zheng2010/xiaorili-desktop";
const branch = "codex/ios-altstore";
const root = process.cwd();

const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const gitBuffer = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "buffer" });

const sleepSync = (ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
};

const callGh = (method, url, body) => {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return gh(method, url, body);
    } catch (error) {
      lastError = error;
      if (attempt < 5) sleepSync(1500 * attempt);
    }
  }
  throw lastError;
};

const gh = (method, url, body) => {
  const args = ["api", "-X", method, url];
  const input = body === undefined ? undefined : JSON.stringify(body);
  if (input !== undefined) args.push("--input", "-");
  const result = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`gh ${method} ${url}: ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : null;
};

const blobExistsOnRemote = (sha) => {
  const result = spawnSync(
    "gh",
    ["api", "repos//git/blobs/", "--jq", ".sha"],
    { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  return result.status === 0 && result.stdout.trim() === sha;
};

execFileSync("git", ["add", "-u"], { cwd: root, encoding: "utf8" });
execFileSync(
  "git",
  [
    "add",
    ".github",
    "capacitor.config.json",
    "docs",
    "public",
    "src/mobile.css",
    "src/mobile.jsx",
    "sync-server.cjs",
    "tests",
    "android",
    "ios",
  ],
  { cwd: root, encoding: "utf8" },
);
const treeSha = git("write-tree");

const listing = execFileSync(
  "git",
  ["-c", "core.quotepath=false", "ls-tree", "-r", "-z", "--full-tree", treeSha],
  { cwd: root, encoding: "utf8" },
);
const records = listing
  .split("\0")
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^(\d{6}) (blob) ([0-9a-f]{40})\t(.+)$/);
    if (!match) throw new Error(`cannot parse tree line: ${line}`);
    return { mode: match[1], sha: match[3], path: match[4] };
  });

const blobMap = new Map();
let uploaded = 0;
let skipped = 0;
for (const record of records) {
  if (blobMap.has(record.sha)) continue;
  if (blobExistsOnRemote(record.sha)) {
    blobMap.set(record.sha, record.sha);
    skipped += 1;
    continue;
  }
  const content = gitBuffer("cat-file", "blob", record.sha);
  const created = callGh("POST", `repos/${repo}/git/blobs`, {
    content: content.toString("base64"),
    encoding: "base64",
  });
  blobMap.set(record.sha, created.sha);
  uploaded += 1;
  if (uploaded % 50 === 0) {
    console.log(`uploaded ${uploaded} blobs, skipped ${skipped}`);
  }
}
console.log(`blobs ready: uploaded ${uploaded}, skipped ${skipped}`);

const rootNode = { children: new Map(), files: [] };
for (const record of records) {
  const parts = record.path.split("/");
  let node = rootNode;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const name = parts[index];
    if (!node.children.has(name)) {
      node.children.set(name, { children: new Map(), files: [] });
    }
    node = node.children.get(name);
  }
  node.files.push({
    name: parts[parts.length - 1],
    mode: record.mode,
    sha: blobMap.get(record.sha),
  });
}

const createTree = (node) => {
  const entries = node.files.map((file) => ({
    path: file.name,
    mode: file.mode,
    type: "blob",
    sha: file.sha,
  }));
  for (const [name, child] of node.children.entries()) {
    entries.push({ path: name, mode: "040000", type: "tree", sha: createTree(child) });
  }
  entries.sort((a, b) => {
    const left = a.type === "tree" ? `${a.path}/` : a.path;
    const right = b.type === "tree" ? `${b.path}/` : b.path;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const created = callGh("POST", `repos/${repo}/git/trees`, { tree: entries });
  return created.sha;
};
const remoteTreeSha = createTree(rootNode);

const parentRef = callGh("GET", `repos/${repo}/git/ref/heads/master`);
const author = {
  name: git("config", "user.name"),
  email: git("config", "user.email"),
  date: new Date().toISOString(),
};
const commit = callGh("POST", `repos/${repo}/git/commits`, {
  message: "Build iOS AltStore app and Huawei APK channel",
  tree: remoteTreeSha,
  parents: [parentRef.object.sha],
  author,
  committer: author,
});

try {
  callGh("POST", `repos/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: commit.sha,
  });
} catch (error) {
  callGh("PATCH", `repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
}

callGh("POST", `repos/${repo}/actions/workflows/ios-altstore.yml/dispatches`, {
  ref: branch,
});

execFileSync("git", ["reset"], { cwd: root, encoding: "utf8" });
console.log(JSON.stringify({ branch, commit: commit.sha, tree: remoteTreeSha }));
