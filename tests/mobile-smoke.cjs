const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const port = 4173 + Math.floor(Math.random() * 500);
const syncPort = 18787 + Math.floor(Math.random() * 500);
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
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

(async () => {
  let server;
  let preview;
  let browser;
  try {
    server = spawn(
      process.execPath,
      [path.join(root, "sync-server.cjs")],
      {
        env: { ...process.env, PORT: String(syncPort), SYNC_DATA_FILE: dataFile },
        stdio: "ignore",
      },
    );
    await waitUrl(`http://127.0.0.1:${syncPort}/health`);

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
    await page.addInitScript((url) => localStorage.setItem("workday-sync-server", url), `http://localhost:${syncPort}`);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector(".mobile-app");
    await page.waitForSelector(".mobile-greeting");
    const heading = await page.locator(".mobile-greeting h2").textContent();
    if (!heading.includes("项安排") && !heading.includes("没有安排")) {
      throw new Error(`unexpected today heading: ${heading}`);
    }

    await page.click(".mobile-fab");
    await page.fill('.mobile-sheet input[placeholder*="例如"]', "手机测试任务");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = dateKey(yesterday);
    const dateInputs = page.locator('.mobile-sheet input[type="date"]');
    await dateInputs.nth(0).fill(overdueDate);
    await dateInputs.nth(1).fill(overdueDate);
    await page.click(".mobile-submit");
    await page.locator(".mobile-task", { hasText: "手机测试任务" }).first().waitFor({ state: "visible" });
    const row = page.locator(".mobile-task", { hasText: "手机测试任务" }).first();
    await row.locator(".mobile-check").click();
    await page.waitForTimeout(200);
    const done = await row.evaluate((element) =>
      element.classList.contains("is-done"),
    );
    const stillVisible = await row.isVisible();

    await page.click('.mobile-tabs button:has-text("日历")');
    await page.waitForSelector(".mobile-month-grid");
    const days = await page.locator(".mobile-month-grid .mobile-day").count();
    if (days !== 42) throw new Error(`expected 42 month days, got ${days}`);
    const todayBadge = await page.locator(".mobile-day.today i").count();
    if (todayBadge === 0) throw new Error("expected completed task badge on today");

    await page.click('.mobile-tabs button:has-text("待办")');
    await page.click('.mobile-filter button:has-text("全部")');
    await page.fill(".mobile-search input", "手机测试");
    await page.locator(".mobile-task", { hasText: "手机测试任务" }).first().waitFor({ state: "visible" });

    await page.click('.mobile-tabs button:has-text("设置")');
    await page.waitForSelector(".mobile-account-panel");
    await page.waitForFunction(() => document.body.innerText.includes("同步服务"));
    const serverValue = await page.inputValue('.mobile-field input[type="url"]');
    if (serverValue !== `http://localhost:${syncPort}`) {
      throw new Error(`unexpected server url: ${serverValue}`);
    }
    await page.click('.mobile-actions button:has-text("测试连接")');
    await page.waitForFunction(() => document.body.innerText.includes("连接成功"));

    const email = `mobile-${Date.now()}@example.com`;
    await page.click('.mobile-segmented button:has-text("注册")');
    await page.fill('.mobile-account-form input[type="email"]', email);
    await page.fill('.mobile-account-form input[type="password"]', "password123");
    await page.click(".mobile-account-form .mobile-btn.primary");
    let smsAccountVisible = false;
    for (let i = 0; i < 30; i += 1) {
      if ((await page.locator(".mobile-account-head").count()) > 0) { smsAccountVisible = true; break; }
      await page.waitForTimeout(300);
    }
    if (!smsAccountVisible) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      throw new Error(`sms account head missing: ${bodyText.slice(0, 600)}`);
    }
    let synced = false;
    for (let i = 0; i < 20; i += 1) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes("已同步")) {
        synced = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!synced) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      throw new Error(`sync text missing: ${bodyText.slice(0, 500)} errors: ${errors.join("; ")}`);
    }

    await page.click('.mobile-actions button:has-text("退出账户")');
    await page.waitForSelector(".mobile-account-form");
    await page.click('.mobile-segmented button:has-text("手机验证码")');
    const registerTabs = page.locator(".mobile-account-form .mobile-segmented").nth(1);
    await registerTabs.locator('button:has-text("注册")').click();
    const phone = `138${String(Date.now()).slice(-8)}`;
    await page.fill('.mobile-account-form input[type="tel"]', phone);
    await page.click('.mobile-sms-row button:has-text("获取验证码")');
    let smsCode = "";
    for (let i = 0; i < 20; i += 1) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const match = bodyText.match(/验证码 (\d{6})/);
      if (match) { smsCode = match[1]; break; }
      await page.waitForTimeout(250);
    }
    if (!smsCode) throw new Error("dev sms code not shown");
    await page.fill('.mobile-sms-row input[type="text"]', smsCode);
    await page.click(".mobile-account-form .mobile-btn.primary");
    let smsAccountShown = false;
    for (let i = 0; i < 30; i += 1) {
      if ((await page.locator(".mobile-account-head").count()) > 0) { smsAccountShown = true; break; }
      await page.waitForTimeout(300);
    }
    if (!smsAccountShown) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      throw new Error(`sms account head missing: ${bodyText.slice(0, 700)}`);
    }
    const accountText = await page.evaluate(() => document.body.innerText);
    if (!accountText.includes(phone)) throw new Error(`sms account not shown: ${accountText.slice(0, 300)}`);
    let smsSynced = false;
    for (let i = 0; i < 20; i += 1) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes("已同步")) { smsSynced = true; break; }
      await page.waitForTimeout(500);
    }
    if (!smsSynced) throw new Error("sms login did not sync");

    await page.evaluate((key) => {
      const tasks = Array.from({ length: 12 }, (_, i) => ({
        id: 9000 + i,
        title: `真实计数${i}`,
        date: key,
        endDate: key,
        time: "09:00",
        tag: "工作",
        remind: true,
        repeat: "none",
        done: false,
      }));
      localStorage.setItem("workday-tasks", JSON.stringify(tasks));
      localStorage.removeItem("workday-account");
    }, dateKey(new Date()));
    await page.reload();
    await page.waitForSelector(".mobile-app");
    await page.click('.mobile-tabs button:has-text("日历")');
    await page.waitForSelector(".mobile-month-grid");
    const todayBadgeText = (await page.locator(".mobile-day.today i").textContent()).trim();
    if (todayBadgeText !== "12") throw new Error(`expected real badge 12, got ${todayBadgeText}`);
    if (todayBadgeText.includes("+")) throw new Error(`badge still truncated: ${todayBadgeText}`);

    console.log(
      JSON.stringify({ heading, days, done, stillVisible, account: email, todayBadgeText, errors }, null, 2),
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
