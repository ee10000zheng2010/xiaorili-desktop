const { _electron } = require("playwright");
const path = require("node:path");

const root = path.join(__dirname, "..");

(async () => {
  const errors = [];
  let app;
  try {
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
    await first.waitForSelector("body", { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const windows = app.windows();
    if (windows.length === 0) throw new Error("no Electron windows opened");

    const summaries = await Promise.all(
      windows.map(async (win) => ({
        title: await win.title(),
        readyState: await win.evaluate(() => document.readyState),
        textLength: await win.evaluate(() => document.body.innerText.length),
        hash: await win.evaluate(() => location.hash),
      })),
    );
    console.log(JSON.stringify({ windows: summaries, errors }, null, 2));

    const health = await fetch("http://127.0.0.1:8787/health");
    const healthData = await health.json();
    if (!healthData.ok) throw new Error("bundled sync server not healthy");
  } finally {
    await app?.close().catch(() => {});
  }
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
})();
