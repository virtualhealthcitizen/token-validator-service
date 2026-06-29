const { contextBridge, ipcRenderer } = require("electron");

// Narrow, safe surface exposed to the renderer. The renderer never touches Node
// or the network directly — it asks the main process to validate over IPC.
// CommonJS (.cjs) so it loads under the default sandbox without ESM caveats.
contextBridge.exposeInMainWorld("tv", {
  isElectron: true,
  platform: process.platform,
  // payload: { token, mode: "direct" | "remote", serviceUrl? }
  validateToken: (payload) => ipcRenderer.invoke("validate-token", payload),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  onToggleTheme: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("menu:toggle-theme", handler);
    return () => ipcRenderer.removeListener("menu:toggle-theme", handler);
  },
});
