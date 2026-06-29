import { app, BrowserWindow, shell, ipcMain, Menu, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set in electron:dev so the window points at the live Vite dev server.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

const REPO_URL = "https://github.com/virtualhealthcitizen/token-validator-service";
const TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";

// ---------------------------------------------------------------------------
// Validation runs in the MAIN process, never the renderer, so the renderer
// never makes the network call directly (no CORS, no creds in the DOM context).
// Tokens are secrets: we never log them and never write them to disk.
//
//  - Direct mode: call Google's tokeninfo endpoint straight from here. Works
//    with zero backend — the default.
//  - Remote mode: POST to a configurable token-validator-service URL
//    (e.g. a locally-run Flask, or an unauthenticated deployment).
// ---------------------------------------------------------------------------
async function validateDirect(token) {
  const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
  const info = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, valid: true, status: res.status, tokenInfo: info, mode: "direct" };
  }
  return {
    ok: true,
    valid: false,
    status: res.status,
    error: info.error_description || info.error || "Invalid or expired token",
    mode: "direct",
  };
}

async function validateRemote(token, serviceUrl) {
  const base = (serviceUrl || "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: "No service URL configured for Remote mode." };
  const res = await fetch(`${base}/api/validate-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  return {
    ok: true,
    valid: Boolean(body.valid),
    status: res.status,
    tokenInfo: body.token_info,
    error: body.valid ? undefined : body.error || `Service returned ${res.status}`,
    mode: "remote",
  };
}

ipcMain.handle("validate-token", async (_evt, payload) => {
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) return { ok: false, error: "Paste a token first." };
  try {
    if (payload?.mode === "remote") {
      return await validateRemote(token, payload.serviceUrl);
    }
    return await validateDirect(token);
  } catch (err) {
    // Never include the token in the surfaced/logged error.
    return { ok: false, error: `Request failed: ${err?.message ?? "network error"}` };
  }
});

ipcMain.handle("open-external", (_evt, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) return shell.openExternal(url);
  return false;
});

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const focused = () =>
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
  const toggleTheme = () => focused()?.webContents.send("menu:toggle-theme");
  const showAbout = () => {
    dialog.showMessageBox(focused() ?? undefined, {
      type: "info",
      title: "About Token Validator",
      message: "Token Validator",
      detail:
        "Validate Google OAuth access tokens and read their claims.\n\n" +
        `Version ${app.getVersion()}\n` +
        `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
      buttons: ["OK"],
      noLink: true,
    });
  };
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { label: "Toggle Theme", accelerator: "CmdOrCtrl+Shift+L", click: toggleTheme },
        { type: "separator" },
        { role: "toggleDevTools" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "View Repository", click: () => shell.openExternal(REPO_URL) },
        { type: "separator" },
        { label: "About Token Validator", click: showAbout },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 940,
    height: 820,
    minWidth: 620,
    minHeight: 560,
    backgroundColor: "#0d1117",
    title: "Token Validator",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildAppMenu());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
