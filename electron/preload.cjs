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
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (_, info) => callback(info)),
  closeWidget: () => ipcRenderer.send("close-widget"),
  openMain: () => ipcRenderer.send("open-main"),
  onNewTask: (callback) => ipcRenderer.on("new-task", callback),
});
