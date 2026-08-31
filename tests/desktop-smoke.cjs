const { _electron } = require("playwright");
const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");

const syncPort = 18787 + Math.floor(Math.random() * 500);
const dataFile = path.join(os.tmpdir(), `xiaorili-desktop-${process.pid}.json`);
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

const root = path.join(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const errors = [];
  let app;
  let syncServer;
  try {
    syncServer = spawn(process.execPath, [path.join(root, "sync-server.cjs")], {
      env: { ...process.env, PORT: String(syncPort), SYNC_DATA_FILE: dataFile, SMS_RESEND_SECONDS: "0" },
      stdio: "ignore",
    });
    await waitUrl(`http://127.0.0.1:${syncPort}/health`);
    const packaged = process.env.SMOKE_EXE;
    app = await _electron.launch({
      ...(packaged ? { executablePath: packaged, args: [] } : { args: ["."] }),
      cwd: root,
      timeout: 60000,
    });
    const trackWindow = (win) => {
      win.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      win.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
    };
    app.on("window", trackWindow);

    const first = await app.firstWindow({ timeout: 60000 });
    trackWindow(first);
    await first.waitForLoadState("domcontentloaded");
    await first.waitForSelector("body", { state: "attached", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const windows = app.windows();
    if (windows.length === 0) throw new Error("no Electron windows opened");

    const tagWindows = async () => {
      const tagged = [];
      for (const win of app.windows()) {
        tagged.push({ win, hash: await win.evaluate(() => location.hash) });
      }
      return tagged;
    };
    let tagged = await tagWindows();
    const mainPage = tagged.find((item) => item.hash !== "#widget")?.win || tagged[0].win;
    let widgetPage = tagged.find((item) => item.hash === "#widget")?.win || null;
    if (!widgetPage) {
      await mainPage.evaluate(() => window.desktop?.openWidget?.());
      for (let i = 0; i < 20; i += 1) {
        tagged = await tagWindows();
        widgetPage = tagged.find((item) => item.hash === "#widget")?.win || null;
        if (widgetPage) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!widgetPage) throw new Error("widget window did not open");
    trackWindow(widgetPage);

    const summaries = await Promise.all(
      tagged.map(async ({ win }) => ({
        title: await win.title(),
        readyState: await win.evaluate(() => document.readyState),
        textLength: await win.evaluate(() => document.body.innerText.length),
        hash: await win.evaluate(() => location.hash),
      })),
    );

    const today = dateKey(new Date());
    const seedTasks = Array.from({ length: 20 }, (_, i) => ({
      id: 70000 + i,
      title: `桌面批量任务${i}`,
      date: today,
      endDate: today,
      time: "09:00",
      tag: "工作",
      remind: true,
      repeat: "none",
      done: false,
    }));
    await mainPage.evaluate(
      (tasks) => localStorage.setItem("workday-tasks", JSON.stringify(tasks)),
      seedTasks,
    );
    await mainPage.evaluate((url) => localStorage.setItem("workday-sync-server", url), `http://localhost:${syncPort}`);

    await mainPage.reload();
    await mainPage.waitForSelector(".calendar-grid", { state: "attached", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    const dayCell = mainPage.locator(".day", { hasText: "桌面批量任务0" }).first();
    const smallCount = await dayCell.locator(".event").count();
    const smallMore = ((await dayCell.locator(".more-count").textContent().catch(() => "")) || "").trim();
    if (smallCount < 2) throw new Error(`calendar should show multiple events, got ${smallCount}`);
    if (!/^\+\d+$/.test(smallMore)) throw new Error(`expected +N overflow marker, got ${smallMore}`);

    const mainHandle = await app.browserWindow(mainPage);
    await mainHandle.evaluate(
      (win, size) => win.setSize(size[0], size[1]),
      [1900, 1200],
    );
    await new Promise((resolve) => setTimeout(resolve, 800));
    const largeCount = await dayCell.locator(".event").count();
    const largeMore = ((await dayCell.locator(".more-count").textContent().catch(() => "")) || "").trim();
    if (largeCount <= smallCount) {
      throw new Error(`larger window should show more events: ${smallCount} -> ${largeCount}`);
    }
    if (Number(largeMore.replace("+", "")) !== 20 - largeCount) {
      throw new Error(`overflow count mismatch: ${largeMore}`);
    }

    await widgetPage.reload();
    await widgetPage.waitForSelector(".widget-day.today i", { state: "attached" });
    const widgetBadge = (await widgetPage.locator(".widget-day.today i").textContent()).trim();
    if (widgetBadge !== "20") throw new Error(`widget badge should show real count 20, got ${widgetBadge}`);
    if (widgetBadge.includes("+")) throw new Error(`widget badge truncated: ${widgetBadge}`);

    await mainPage.click('.sidebar button:has-text("偏好设置")');
    await mainPage.waitForSelector(".account-panel");
    const smsTabCount = await mainPage.locator('.account-panel button:has-text("手机验证码")').count();
    if (smsTabCount === 0) throw new Error("desktop sms login tab missing");
    await mainPage.click('.account-panel button:has-text("手机验证码")');
    const smsPhone = `136${String(Date.now()).slice(-8)}`;
    await mainPage.click('.account-panel .segmented button:has-text("注册")');
    await mainPage.fill('.account-panel input[type="tel"]', smsPhone);
    await mainPage.click('.account-panel .sms-code-row button:has-text("获取验证码")');
    let smsCode = "";
    for (let i = 0; i < 20; i += 1) {
      const bodyText = await mainPage.evaluate(() => document.body.innerText);
      const match = bodyText.match(/验证码 (\d{6})/);
      if (match) { smsCode = match[1]; break; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!smsCode) {
      const bodyText = await mainPage.evaluate(() => document.body.innerText);
      throw new Error(`desktop dev sms code not shown: ${bodyText.slice(0, 700)}`);
    }
    await mainPage.fill('.account-panel .sms-code-row input[type="text"]', smsCode);
    await mainPage.click('.account-panel .primary-action[type="submit"]');
    await mainPage.waitForSelector(".account-heading");
    let smsSynced = false;
    for (let i = 0; i < 20; i += 1) {
      const bodyText = await mainPage.evaluate(() => document.body.innerText);
      if (bodyText.includes("已同步")) { smsSynced = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!smsSynced) throw new Error("desktop sms login did not sync");

    console.log(
      JSON.stringify(
        { windows: summaries, smallCount, smallMore, largeCount, largeMore, widgetBadge, errors },
        null,
        2,
      ),
    );

    const health = await fetch(`http://127.0.0.1:${syncPort}/health`);
    const healthData = await health.json();
    if (!healthData.ok) throw new Error("shared sync server not healthy");
  } finally {
    await app?.close().catch(() => {});
    syncServer?.kill();
    try {
      fs.unlinkSync(dataFile);
    } catch {}
  }
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
})();
