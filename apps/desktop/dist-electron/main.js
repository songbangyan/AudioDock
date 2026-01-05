import { ipcMain as o, app as p, dialog as U, shell as C, screen as P, BrowserWindow as f, protocol as b, net as x, Menu as D, Tray as u, nativeImage as W } from "electron";
import { fileURLToPath as $ } from "node:url";
import j from "os";
import c from "path";
function M() {
  const n = j.hostname().replace(/\.local$/, ""), e = process.platform;
  return e === "darwin" ? `${n}（Mac）` : e === "win32" ? `${n}（Windows）` : n;
}
o.handle("get-device-name", () => M());
o.handle("get-auto-launch", () => p.getLoginItemSettings().openAtLogin);
o.handle("player:get-state", () => l);
o.handle("set-auto-launch", (n, e) => {
  p.setLoginItemSettings({
    openAtLogin: e,
    path: process.execPath
  });
});
o.handle("select-directory", async () => {
  if (!t) return null;
  const n = await U.showOpenDialog(t, {
    properties: ["openDirectory"]
  });
  return n.canceled ? null : n.filePaths[0];
});
o.handle("open-url", (n, e) => (console.log("Opening URL:", e), C.openExternal(e)));
const w = c.dirname($(import.meta.url));
process.env.DIST = c.join(w, "../dist");
process.env.VITE_PUBLIC = p.isPackaged ? process.env.DIST : c.join(process.env.DIST, "../public");
let t = null, r = null, s = null, v = null, y = null, d = null, m = null, l = {
  isPlaying: !1,
  track: null
}, E = !0, I = !1;
function T(n = !0) {
  const e = l.isPlaying ? "pause.png" : "play.png";
  y?.setImage(c.join(process.env.VITE_PUBLIC, e)), process.platform === "darwin" && n && (l.track ? d?.setTitle(`${l.track.name} - ${l.track.artist}`) : d?.setTitle(""));
  const i = [];
  l.track && i.push(
    { label: `♫ ${l.track.name}`, enabled: !1 },
    { label: `   ${l.track.artist}`, enabled: !1 },
    { type: "separator" },
    { label: "⏮ 上一曲", click: () => t?.webContents.send("player:prev") },
    {
      label: l.isPlaying ? "⏸ 暂停" : "▶️ 播放",
      click: () => t?.webContents.send("player:toggle")
    },
    { label: "⏭ 下一曲", click: () => t?.webContents.send("player:next") },
    { type: "separator" }
  ), i.push(
    { label: "打开播放器", click: () => t?.show() },
    { label: "退出", click: () => p.quit() }
  );
  const a = D.buildFromTemplate(i);
  m?.setContextMenu(a);
}
o.on("player:update", (n, e) => {
  l = { ...l, ...e };
  const i = e.track !== void 0;
  T(i), r?.webContents.send("player:update", e), s?.webContents.send("player:update", e);
});
o.on("settings:update-minimize-to-tray", (n, e) => {
  E = e;
});
o.on("lyric:update", (n, e) => {
  const { currentLyric: i } = e;
  if (process.platform === "darwin") {
    const a = i || (l.track ? `${l.track.name} - ${l.track.artist}` : "");
    d?.setTitle(a);
  }
  r?.webContents.send("lyric:update", e), s?.webContents.send("lyric:update", e);
});
o.on("lyric:settings-update", (n, e) => {
  r?.webContents.send("lyric:settings-update", e);
});
o.on("lyric:open", (n, e) => {
  A(e);
});
o.on("lyric:close", () => {
  r && (r.close(), r = null);
});
o.on("lyric:set-mouse-ignore", (n, e) => {
  r?.setIgnoreMouseEvents(e, { forward: !0 });
});
o.on("player:toggle", () => {
  console.log("Main process: received player:toggle"), t ? (console.log("Main process: forwarding player:toggle to main window"), t.webContents.send("player:toggle")) : console.warn("Main process: win is null, cannot forward player:toggle");
});
o.on("player:next", () => {
  console.log("Main process: received player:next"), t?.webContents.send("player:next");
});
o.on("player:prev", () => {
  t?.webContents.send("player:prev");
});
o.on("player:seek", (n, e) => {
  t?.webContents.send("player:seek", e);
});
o.on("window:set-mini", () => {
  t && (t.hide(), O());
});
o.on("window:restore-main", () => {
  s && (s.close(), s = null), t && (t.show(), t.center());
});
o.on("app:show-main", () => {
  t && (t.isVisible() ? t.focus() : t.show());
});
o.on("window:set-always-on-top", (n, e) => {
  s && s.setAlwaysOnTop(e, "floating");
});
function O() {
  if (s) {
    s.show();
    return;
  }
  s = new f({
    width: 360,
    height: 170,
    frame: !1,
    titleBarStyle: "hidden",
    resizable: !1,
    alwaysOnTop: !0,
    // Start always on top
    skipTaskbar: !0,
    hasShadow: !1,
    transparent: !0,
    webPreferences: {
      contextIsolation: !0,
      nodeIntegration: !1,
      preload: c.join(w, "preload.mjs")
    }
  });
  const n = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/mini` : "app://./index.html#/mini";
  process.env.VITE_DEV_SERVER_URL, s.loadURL(n), process.platform === "darwin" && (s.setAlwaysOnTop(!0, "floating"), s.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 })), s.on("closed", () => {
    s = null;
  });
}
function R() {
  t = new f({
    icon: c.join(process.env.VITE_PUBLIC, "logo.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "rgba(0,0,0,0)",
      symbolColor: "#ffffff",
      height: 30
    },
    width: 1020,
    // 初始宽度
    height: 700,
    // 初始高度
    minWidth: 1020,
    // 🔧 设置窗口最小宽度
    minHeight: 700,
    // 🔧 设置窗口最小高度
    transparent: process.platform === "darwin",
    opacity: 0.95,
    vibrancy: "popover",
    visualEffectState: "active",
    webPreferences: {
      contextIsolation: !0,
      // 明确开启
      nodeIntegration: !1,
      // 保持安全
      preload: c.join(w, "preload.mjs")
    }
  }), t.on("close", (n) => (!I && E && (n.preventDefault(), t?.hide()), !1)), process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadURL("app://./index.html");
}
function A(n) {
  if (r) return;
  const { width: e, height: i } = P.getPrimaryDisplay().workAreaSize, a = 800, g = 120, V = n?.x !== void 0 ? n.x : Math.floor((e - a) / 2), _ = n?.y !== void 0 ? n.y : i - g - 50;
  r = new f({
    width: a,
    height: g,
    x: V,
    y: _,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    resizable: !0,
    hasShadow: !1,
    hiddenInMissionControl: !0,
    // Prevent Mission Control interference
    webPreferences: {
      contextIsolation: !0,
      nodeIntegration: !1,
      preload: c.join(w, "preload.mjs")
    }
  });
  const k = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/lyric` : `${c.join(process.env.DIST, "index.html")}#/lyric`;
  process.env.VITE_DEV_SERVER_URL ? r.loadURL(k) : r.loadURL("app://./index.html#/lyric"), process.platform === "darwin" && (r.setAlwaysOnTop(!0, "screen-saver"), r.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }));
  let h = null;
  r.on("move", () => {
    h && clearTimeout(h), h = setTimeout(() => {
      if (r && t) {
        const [L, S] = r.getPosition();
        t.webContents.send("lyric:position-updated", { x: L, y: S });
      }
    }, 500);
  }), r.on("closed", () => {
    r = null;
  });
}
function B() {
  const n = (e, i = 20) => W.createFromPath(c.join(process.env.VITE_PUBLIC, e)).resize({ width: i, height: i });
  d = new u(n("next.png")), y = new u(n("play.png")), v = new u(n("previous.png")), m = new u(n("mini_logo.png")), d.on("click", () => {
    t?.webContents.send("player:next");
  }), y.on("click", () => {
    t?.webContents.send("player:toggle");
  }), v.on("click", () => {
    t?.webContents.send("player:prev");
  }), m.on("click", () => {
    t && (t.isVisible() ? t.focus() : t.show());
  }), T();
}
p.on("before-quit", () => {
  I = !0;
});
b.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: !0,
      // ← 关键！开启 localStorage、cookie 等
      secure: !0,
      // 推荐开启
      supportFetchAPI: !0,
      // 推荐开启，尤其是用 fetch 的项目
      bypassCSP: !1
      // 通常 false 更安全，除非你真的需要
      // corsEnabled: true     // 如果有跨域需求再开
    }
  }
]);
p.whenReady().then(() => {
  b.handle("app", (n) => {
    const e = new URL(n.url), i = decodeURIComponent(e.pathname);
    let a = i === "/" ? "index.html" : i;
    return a.startsWith("/") && (a = a.slice(1)), x.fetch(`file://${c.join(process.env.DIST, a)}`);
  }), R(), B();
});
p.on("window-all-closed", () => {
  process.platform !== "darwin" && p.quit();
});
p.on("activate", () => {
  f.getAllWindows().length === 0 ? R() : t?.show();
});
