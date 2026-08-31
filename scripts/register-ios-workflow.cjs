const { spawnSync } = require("node:child_process");

const repo = "ee10000zheng2010/xiaorili-desktop";
const root = process.cwd();

const gh = (method, url, body) => {
  const args = ["api", "-X", method, url];
  const input = body === undefined ? undefined : JSON.stringify(body);
  if (input !== undefined) args.push("--input", "-");
  const result = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`gh ${method} ${url}: ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : null;
};

const originalRef = gh("GET", `repos/${repo}/git/ref/heads/master`);
const originalSha = originalRef.object.sha;
const log = (label, value) => console.log(`${label}: ${value}`);
log("originalSha", originalSha);

const workflowSha = "e5ce6822f6bfbe16c9ca51c5e7a0bea589d4f00d";
const rootTree = gh("GET", `repos/${repo}/git/trees/${originalSha}`).tree;
const githubTree = rootTree.find((entry) => entry.path === ".github");
const workflowsTree = githubTree
  ? gh("GET", `repos/${repo}/git/trees/${githubTree.sha}`).tree.find((entry) => entry.path === "workflows")
  : undefined;
const existingWorkflowEntries = workflowsTree
  ? gh("GET", `repos/${repo}/git/trees/${workflowsTree.sha}`).tree
      .filter((entry) => entry.path !== "ios-altstore.yml")
      .map((entry) => ({ path: entry.path, mode: entry.mode, type: entry.type, sha: entry.sha }))
  : [];
const workflowsTreeNew = gh("POST", `repos/${repo}/git/trees`, {
  tree: [
    ...existingWorkflowEntries,
    { path: "ios-altstore.yml", mode: "100644", type: "blob", sha: workflowSha },
  ],
}).sha;
log("workflowsTreeNew", workflowsTreeNew);
const githubEntries = githubTree
  ? gh("GET", `repos/${repo}/git/trees/${githubTree.sha}`).tree
      .filter((entry) => entry.path !== "workflows")
      .map((entry) => ({ path: entry.path, mode: entry.mode, type: entry.type, sha: entry.sha }))
  : [];
const githubTreeNew = gh("POST", `repos/${repo}/git/trees`, {
  tree: [
    ...githubEntries,
    { path: "workflows", mode: "040000", type: "tree", sha: workflowsTreeNew },
  ],
}).sha;
log("githubTreeNew", githubTreeNew);

const tree = gh("POST", `repos/${repo}/git/trees`, {
  tree: [
    ...rootTree
      .filter((entry) => entry.path !== ".github")
      .map((entry) => ({ path: entry.path, mode: entry.mode, type: entry.type, sha: entry.sha })),
    { path: ".github", mode: "040000", type: "tree", sha: githubTreeNew },
  ],
}).sha;
log("rootTreeNew", tree);

const now = new Date();
const author = {
  name: "Codex",
  email: "codex@localhost",
  date: now.toISOString(),
};
const commit = gh("POST", `repos/${repo}/git/commits`, {
  message: "chore: register iOS AltStore workflow",
  tree,
  parents: [originalSha],
  author,
  committer: author,
});
gh("PATCH", `repos/${repo}/git/refs/heads/master`, { sha: commit.sha, force: true });
log("tempCommit", commit.sha);

let dispatched = false;
try {
  gh("POST", `repos/${repo}/actions/workflows/ios-altstore.yml/dispatches`, {
    ref: "codex/ios-altstore",
  });
  dispatched = true;
} catch (error) {
  console.log("dispatch failed:", error.message);
}
console.log(JSON.stringify({ originalSha, tempCommit: commit.sha, tree, dispatched }));
