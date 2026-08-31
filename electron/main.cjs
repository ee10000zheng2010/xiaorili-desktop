const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  nativeImage,
  ipcMain,
  globalShortcut,
  screen,
  clipboard,
} = require("electron");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

let mainWindow;
let widgetWindow;
let tray;
let syncServer;
const settingsPath = path.join(app.getPath("userData"), "settings.json");
const rendererLog = path.join(app.getPath("userData"), "renderer.log");
const logRenderer = (text) => {
  try {
    fs.appendFileSync(rendererLog, `${new Date().toISOString()} ${text}\n`);
  } catch {}
};
const readSettings = () => {
  try {
    return {
      launchAtStartup: false,
      desktopMode: true,
      opacity: 1,
      alwaysOnTop: false,
      widgetBounds: null,
      ...JSON.parse(fs.readFileSync(settingsPath, "utf8")),
    };
  } catch {
    return {
      launchAtStartup: false,
      desktopMode: true,
      opacity: 1,
      alwaysOnTop: false,
      widgetBounds: null,
    };
  }
};
const writeSettings = (settings) =>
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
const appFile = (file) => path.join(__dirname, "..", "dist", file);
const iconFile = path.join(__dirname, "..", "assets", "app-icon.png");

function createWindow() {
  const settings = readSettings();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#e8dcc7",
    title: "Workday Calendar",
    icon: iconFile,
    show: !settings.desktopMode,
    opacity: settings.opacity || 1,
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow.loadFile(appFile("index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("did-fail-load", (_, code, description) =>
    console.error("Renderer failed:", code, description),
  );
  mainWindow.webContents.on(
    "console-message",
    (_, level, message, line, sourceId) =>
      logRenderer(`console level=${level} ${sourceId}:${line} ${message}`),
  );
  mainWindow.webContents.on("render-process-gone", (_, details) =>
    logRenderer(`render-process-gone ${JSON.stringify(details)}`),
  );
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Workday Calendar",
        submenu: [{ role: "about" }, { role: "quit" }],
      },
      {
        label: "Window",
        submenu: [
          { role: "reload" },
          { role: "toggledevtools" },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
}
function showWindow() {
  if (!mainWindow) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
}
function showWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    widgetWindow.focus();
    return;
  }
  const settings = readSettings();
  const savedBounds = settings.widgetBounds;
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const hasValidPosition = savedBounds &&
    Number.isFinite(savedBounds.x) && Number.isFinite(savedBounds.y) &&
    savedBounds.x < workArea.x + workArea.width - 80 &&
    savedBounds.x + (savedBounds.width || 440) > workArea.x + 80 &&
    savedBounds.y < workArea.y + workArea.height - 80 &&
    savedBounds.y + (savedBounds.height || 600) > workArea.y + 80;
  widgetWindow = new BrowserWindow({
    width: 440,
    height: 600,
    ...(hasValidPosition ? { x: savedBounds.x, y: savedBounds.y } : {}),
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    backgroundColor: "#e8dcc7",
    icon: iconFile,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  widgetWindow.loadFile(appFile("index.html"), { hash: "widget" });
  widgetWindow.on("moved", () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      writeSettings({ ...readSettings(), widgetBounds: widgetWindow.getBounds() });
    }
  });
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}
function broadcastDataChanged() {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.webContents.send("data-changed");
}
function createTray() {
  const icon = nativeImage.createFromPath(iconFile);
  tray = new Tray(icon);
  tray.setToolTip("Workday Calendar");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Calendar", click: showWindow },
      { label: "Open Desktop Widget", click: showWidget },
      {
        label: "New Task",
        click: () => {
          showWindow();
          mainWindow.webContents.send("new-task");
        },
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", showWindow);
}
function startSyncServer() {
  if (syncServer) return;
  const script = app.isPackaged
    ? path.join(app.getAppPath(), "sync-server.cjs")
    : path.join(__dirname, "..", "sync-server.cjs");
  syncServer = spawn(process.execPath, [script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: "8787", SYNC_DATA_FILE: path.join(app.getPath("userData"), "sync-data.json") },
    stdio: "ignore",
    windowsHide: true,
  });
  syncServer.once("exit", () => { syncServer = null; });
}
app.whenReady().then(() => {
  startSyncServer();
  const settings = readSettings();
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtStartup) });
  createWindow();
  createTray();
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    setTimeout(() => autoUpdater.checkForUpdates().catch((error) =>
      logRenderer(`update-check ${error.message}`)), 10000);
    autoUpdater.on("update-available", (info) =>
      mainWindow?.webContents.send("update-available", info),
    );
    autoUpdater.on("update-downloaded", (info) =>
      mainWindow?.webContents.send("update-downloaded", info),
    );
  }
  if (settings.desktopMode) showWidget();
  globalShortcut.register("CommandOrControl+Alt+K", showWindow);
  globalShortcut.register("CommandOrControl+Alt+N", () => {
    showWindow();
    mainWindow.webContents.send("new-task");
  });
  app.on("activate", showWindow);
});
ipcMain.handle("notify", (_, payload) => {
  if (Notification.isSupported())
    new Notification({ title: payload.title, body: payload.body }).show();
});
ipcMain.handle("get-settings", () => readSettings());
ipcMain.handle("set-launch-at-startup", (_, enabled) => {
  const settings = { ...readSettings(), launchAtStartup: Boolean(enabled) };
  writeSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup });
  return settings;
});
ipcMain.handle("set-window-opacity", (_, value) => {
  const opacity = Math.min(1, Math.max(0.55, Number(value) || 1));
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(opacity);
  const settings = { ...readSettings(), opacity };
  writeSettings(settings);
  return settings;
});
ipcMain.handle("set-always-on-top", (_, enabled) => {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.setAlwaysOnTop(Boolean(enabled));
  const settings = { ...readSettings(), alwaysOnTop: Boolean(enabled) };
  writeSettings(settings);
  return settings;
});
ipcMain.handle("set-desktop-mode", (_, enabled) => {
  const settings = { ...readSettings(), desktopMode: Boolean(enabled) };
  writeSettings(settings);
  if (enabled) showWidget();
  else if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.hide();
  return settings;
});
ipcMain.handle("app-info", () => ({
  version: app.getVersion(),
  platform: process.platform,
}));
ipcMain.handle("read-clipboard-image", () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return { ok: false, message: "剪贴板中没有图片" };
  return { ok: true, dataUrl: image.toDataURL(), width: image.getSize().width, height: image.getSize().height };
});
ipcMain.handle("check-for-updates", async () => {
  if (app.isPackaged) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { available: Boolean(result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()), version: result?.updateInfo?.version || app.getVersion(), downloading: true };
    } catch (error) {
      logRenderer(`update-check ${error.message}`);
      return { available: false, version: app.getVersion(), message: "暂时无法连接更新服务" };
    }
  }
  const manifestUrl = process.env.WORKDAY_UPDATE_URL;
  if (!manifestUrl)
    return {
      available: false,
      version: app.getVersion(),
      message: "未配置更新服务地址",
    };
  try {
    const response = await fetch(manifestUrl);
    const manifest = await response.json();
    return {
      available: Boolean(
        manifest.version && manifest.version !== app.getVersion(),
      ),
      version: manifest.version || app.getVersion(),
      url: manifest.url || "",
    };
  } catch {
    return {
      available: false,
      version: app.getVersion(),
      message: "更新服务暂时不可用",
    };
  }
});
ipcMain.handle("install-update", () => {
  if (app.isPackaged) autoUpdater.quitAndInstall(false, true);
});
ipcMain.on("close-widget", () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
});
ipcMain.on("open-main", showWindow);
ipcMain.on("open-widget", showWidget);
ipcMain.on("data-changed", broadcastDataChanged);
app.on("before-quit", () => {
  app.isQuitting = true;
  syncServer?.kill();
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
