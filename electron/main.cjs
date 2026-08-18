const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  nativeImage,
  ipcMain,
  globalShortcut,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

let mainWindow;
let widgetWindow;
let tray;
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
      ...JSON.parse(fs.readFileSync(settingsPath, "utf8")),
    };
  } catch {
    return {
      launchAtStartup: false,
      desktopMode: true,
      opacity: 1,
      alwaysOnTop: false,
    };
  }
};
const writeSettings = (settings) =>
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
const appFile = (file) => path.join(__dirname, "..", "dist", file);

function createWindow() {
  const settings = readSettings();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#e8dcc7",
    title: "Workday Calendar",
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
  widgetWindow = new BrowserWindow({
    width: 440,
    height: 600,
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    backgroundColor: "#e8dcc7",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  widgetWindow.loadFile(appFile("index.html"), { hash: "widget" });
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}
function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAKElEQVR42mNkYGD4z0AEYBxVSFQYGBgYGBj+////PwMDAwMAAAQCAQAA3CkGAAAAAElFTkSuQmCC",
  );
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
app.whenReady().then(() => {
  const settings = readSettings();
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtStartup) });
  createWindow();
  createTray();
  if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater
      .checkForUpdates()
      .catch((error) => logRenderer(`update-check ${error.message}`));
    autoUpdater.on("update-available", (info) =>
      mainWindow?.webContents.send("update-available", info),
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
ipcMain.handle("check-for-updates", async () => {
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
ipcMain.on("close-widget", () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
});
ipcMain.on("open-main", showWindow);
app.on("before-quit", () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
