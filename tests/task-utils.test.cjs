const test = require("node:test");
const assert = require("node:assert/strict");

test("unfinished one-day task carries to every following day", async () => {
  const { inRange, effectiveEnd } = await import("../src/task-utils.js");
  const task = { date: "2026-08-01", endDate: "2026-08-01", done: false };
  assert.equal(inRange(task, "2026-08-01", "2026-08-04"), true);
  assert.equal(inRange(task, "2026-08-02", "2026-08-04"), true);
  assert.equal(inRange(task, "2026-08-03", "2026-08-04"), true);
  assert.equal(inRange(task, "2026-08-04", "2026-08-04"), true);
  assert.equal(inRange(task, "2026-08-05", "2026-08-04"), false);
  assert.equal(effectiveEnd(task, "2026-08-04"), "2026-08-04");
});

test("completed task stays visible through its completion date", async () => {
  const { inRange } = await import("../src/task-utils.js");
  const task = {
    date: "2026-08-01",
    endDate: "2026-08-01",
    done: true,
    doneAt: new Date(2026, 7, 3, 9, 0, 0).getTime(),
  };
  assert.equal(inRange(task, "2026-08-01", "2026-08-10"), true);
  assert.equal(inRange(task, "2026-08-02", "2026-08-10"), true);
  assert.equal(inRange(task, "2026-08-03", "2026-08-10"), true);
  assert.equal(inRange(task, "2026-08-04", "2026-08-10"), false);
});

test("completed task without completion timestamp keeps original date", async () => {
  const { inRange } = await import("../src/task-utils.js");
  const task = { date: "2026-08-01", endDate: "2026-08-01", done: true };
  assert.equal(inRange(task, "2026-08-01", "2026-08-10"), true);
  assert.equal(inRange(task, "2026-08-02", "2026-08-10"), false);
});

test("planned multi-day range is preserved", async () => {
  const { inRange } = await import("../src/task-utils.js");
  const task = { date: "2026-08-05", endDate: "2026-08-08", done: false };
  assert.equal(inRange(task, "2026-08-05", "2026-08-01"), true);
  assert.equal(inRange(task, "2026-08-08", "2026-08-01"), true);
  assert.equal(inRange(task, "2026-08-09", "2026-08-01"), false);
});
