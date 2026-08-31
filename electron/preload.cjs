const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  notify: (payload) => ipcRenderer.invoke("notify", payload),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setLaunchAtStartup: (enabled) =>
    ipcRenderer.invoke("set-launch-at-startup", enabled),
  setWindowOpacity: (value) => ipcRenderer.invoke("set-window-opacity", value),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("set-always-on-top", enabled),
  setDesktopMode: (enabled) => ipcRenderer.invoke("set-desktop-mode", enabled),
  appInfo: () => ipcRenderer.invoke("app-info"),
  readClipboardImage: () => ipcRenderer.invoke("read-clipboard-image"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateAvailable: (callback) => { const listener = (_, info) => callback(info); ipcRenderer.on("update-available", listener); return () => ipcRenderer.removeListener("update-available", listener); },
  onUpdateDownloaded: (callback) => { const listener = (_, info) => callback(info); ipcRenderer.on("update-downloaded", listener); return () => ipcRenderer.removeListener("update-downloaded", listener); },
  installUpdate: () => ipcRenderer.invoke("install-update"),
  closeWidget: () => ipcRenderer.send("close-widget"),
  openMain: () => ipcRenderer.send("open-main"),
  openWidget: () => ipcRenderer.send("open-widget"),
  onDataChanged: (callback) => { const listener = () => callback(); ipcRenderer.on("data-changed", listener); return () => ipcRenderer.removeListener("data-changed", listener); },
  notifyDataChanged: () => ipcRenderer.send("data-changed"),
  onNewTask: (callback) => ipcRenderer.on("new-task", callback),
});
