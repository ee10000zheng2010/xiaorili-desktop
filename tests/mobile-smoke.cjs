const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const port = 4173 + Math.floor(Math.random() * 500);
const dataFile = path.join(os.tmpdir(), `xiaorili-mobile-${process.pid}.json`);
const waitUrl = async (url, attempts = 40) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server not ready: ${url}`);
};

(async () => {
  let server;
  let preview;
  let browser;
  try {
    server = spawn(
      process.execPath,
      [path.join(root, "sync-server.cjs")],
      {
        env: { ...process.env, PORT: "8787", SYNC_DATA_FILE: dataFile },
        stdio: "ignore",
      },
    );
    await waitUrl("http://127.0.0.1:8787/health");

    preview = spawn(
      process.execPath,
      [
        path.join(root, "node_modules", "vite", "bin", "vite.js"),
        "preview",
        "--port",
        String(port),
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
    await waitUrl(`http://localhost:${port}`);

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector(".mobile-app");
    await page.waitForSelector(".mobile-greeting");
    const heading = await page.locator(".mobile-greeting h2").textContent();
    if (!heading.includes("项安排") && !heading.includes("没有安排")) {
      throw new Error(`unexpected today heading: ${heading}`);
    }

    await page.click(".mobile-fab");
    await page.fill('.mobile-sheet input[placeholder*="例如"]', "手机测试任务");
    await page.click(".mobile-submit");
    await page.locator(".mobile-task", { hasText: "手机测试任务" }).first().waitFor({ state: "visible" });
    const row = page.locator(".mobile-task", { hasText: "手机测试任务" }).first();
    await row.locator(".mobile-check").click();
    await page.waitForTimeout(200);
    const done = await row.evaluate((element) =>
      element.classList.contains("is-done"),
    );

    await page.click('.mobile-tabs button:has-text("日历")');
    await page.waitForSelector(".mobile-month-grid");
    const days = await page.locator(".mobile-month-grid .mobile-day").count();
    if (days !== 42) throw new Error(`expected 42 month days, got ${days}`);

    await page.click('.mobile-tabs button:has-text("待办")');
    await page.click('.mobile-filter button:has-text("全部")');
    await page.fill(".mobile-search input", "手机测试");
    await page.locator(".mobile-task", { hasText: "手机测试任务" }).first().waitFor({ state: "visible" });

    await page.click('.mobile-tabs button:has-text("设置")');
    await page.waitForSelector(".mobile-account-panel");
    await page.waitForFunction(() => document.body.innerText.includes("同步服务"));
    const serverValue = await page.inputValue('.mobile-field input[type="url"]');
    if (serverValue !== "http://localhost:8787") {
      throw new Error(`unexpected server url: ${serverValue}`);
    }
    await page.click('.mobile-actions button:has-text("测试连接")');
    await page.waitForFunction(() => document.body.innerText.includes("连接成功"));

    const email = `mobile-${Date.now()}@example.com`;
    await page.click('.mobile-segmented button:has-text("注册")');
    await page.fill('.mobile-account-form input[type="email"]', email);
    await page.fill('.mobile-account-form input[type="password"]', "password123");
    await page.click(".mobile-account-form .mobile-btn.primary");
    await page.waitForSelector(".mobile-account-head");
    await page.waitForFunction(() => document.body.innerText.includes("已同步"));

    console.log(
      JSON.stringify({ heading, days, done, account: email, errors }, null, 2),
    );
    if (errors.length > 0) throw new Error(errors.join("\n"));
  } finally {
    await browser?.close().catch(() => {});
    preview?.kill();
    server?.kill();
    try {
      fs.unlinkSync(dataFile);
    } catch {}
  }
})();
