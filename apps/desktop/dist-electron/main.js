import { spawn as H } from "child_process";
import { ipcMain as l, app as w, dialog as K, shell as z, net as k, screen as Z, BrowserWindow as I, protocol as U, Menu as ee, Tray as j, nativeImage as te } from "electron";
import i from "fs";
import { fileURLToPath as ne, pathToFileURL as B } from "node:url";
import R from "os";
import r from "path";
import { Readable as J } from "stream";
import { pipeline as oe } from "stream/promises";
function re() {
  const t = R.hostname().replace(/\.local$/, ""), e = process.platform;
  return e === "darwin" ? `${t}（Mac）` : e === "win32" ? `${t}（Windows）` : t;
}
const ae = (t) => new Promise((e) => {
  const n = H("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    t
  ]);
  let s = "";
  n.stdout.on("data", (u) => s += u.toString()), n.on("close", () => e(s.trim())), n.on("error", (u) => {
    console.warn("ffprobe failed", u), e("");
  });
});
l.handle("get-device-name", () => re());
l.handle("get-auto-launch", () => w.getLoginItemSettings().openAtLogin);
l.handle("player:get-state", () => m);
l.handle("set-auto-launch", (t, e) => {
  w.setLoginItemSettings({
    openAtLogin: e,
    path: process.execPath
  });
});
l.handle("select-directory", async () => {
  if (!o) return null;
  const t = await K.showOpenDialog(o, {
    properties: ["openDirectory"]
  });
  return t.canceled ? null : t.filePaths[0];
});
l.handle("open-url", (t, e) => (console.log("Opening URL:", e), z.openExternal(e)));
l.handle("open-directory", async (t, e) => {
  const n = e.replace(/^~/, R.homedir());
  if (!i.existsSync(n))
    try {
      i.mkdirSync(n, { recursive: !0 });
    } catch (s) {
      return console.error("Failed to create directory:", s), "Directory does not exist and could not be created";
    }
  return z.openPath(n);
});
const g = r.join(w.getPath("userData"), "audio_cache");
i.existsSync(g) || i.mkdirSync(g, { recursive: !0 });
const se = (t, e, n, s) => {
  const u = decodeURIComponent(s), v = r.basename(u), a = e === "MUSIC" ? "music" : r.join("audio", n.replace(/[/\\?%*:|"<>]/g, "-"));
  return {
    filePath: r.join(t.replace(/^~/, R.homedir()), a, v),
    relPath: r.join(a, v).replace(/\\/g, "/")
  };
}, _ = /* @__PURE__ */ new Map();
l.handle("cache:check", async (t, e, n, s, u, v) => {
  const a = r.join(g, `${e}.json`);
  if (!i.existsSync(a)) return null;
  try {
    const h = JSON.parse(i.readFileSync(a, "utf8"));
    if (!h.localPath) return null;
    const c = r.join(s.replace(/^~/, R.homedir()), h.localPath);
    if (i.existsSync(c) && i.statSync(c).size > 0)
      return `media://audio/${h.localPath}`;
  } catch (h) {
    console.error("[Main] cache:check error", h);
  }
  return null;
});
l.handle("cache:download", async (t, e, n, s, u, v, a, h) => {
  if (_.has(e)) return _.get(e);
  const c = (async () => {
    let p = "";
    try {
      const { filePath: b, relPath: S } = se(s, u, v, new URL(n).pathname), y = r.dirname(b);
      if (i.existsSync(y) || i.mkdirSync(y, { recursive: !0 }), p = b + ".tmp", i.existsSync(b))
        return a.localPath = S, i.writeFileSync(r.join(g, `${e}.json`), JSON.stringify(a, null, 2)), `media://audio/${S}`;
      console.log(`[Main] Starting split download for track ${e}: ${n}`);
      const P = { "User-Agent": "SoundX-Desktop" };
      h && (P.Authorization = `Bearer ${h}`);
      const C = await k.fetch(n, { headers: P });
      if (!C.ok) throw new Error(`Fetch failed: ${C.status}`);
      const A = C.body;
      if (!A) throw new Error("Body empty");
      if (await oe(J.fromWeb(A), i.createWriteStream(p)), i.renameSync(p, b), a.cover)
        try {
          const E = a.cover;
          console.log(`[Main] Downloading cover: ${E}`);
          const G = r.extname(new URL(E).pathname) || ".jpg", D = `${e}_cover${G}`, x = await k.fetch(E);
          if (x.ok && x.body) {
            const F = x.headers.get("content-type");
            if (F && F.includes("text/html"))
              throw new Error("Received HTML instead of image (likely dev server fallback)");
            const W = await x.arrayBuffer(), O = Buffer.from(W.slice(0, 10)).toString();
            if (O.toLowerCase().includes("<!doc") || O.toLowerCase().includes("<html"))
              throw new Error("Response content looks like HTML");
            i.writeFileSync(r.join(g, D), Buffer.from(W)), a.cover = `media://cover/${D}`;
          }
        } catch (E) {
          console.error("[Main] Cover download failed:", E);
        }
      return a.localPath = S, i.writeFileSync(r.join(g, `${e}.json`), JSON.stringify(a, null, 2)), console.log(`[Main] Successfully cached/downloaded track ${e}`), `media://audio/${S}`;
    } catch (b) {
      if (console.error(`[Main] Split download failed for ${e}:`, b), p && i.existsSync(p)) try {
        i.unlinkSync(p);
      } catch {
      }
      return null;
    } finally {
      _.delete(e);
    }
  })();
  return _.set(e, c), c;
});
l.handle("cache:list", async (t, e, n) => {
  try {
    const s = [];
    if (!i.existsSync(g)) return [];
    const u = i.readdirSync(g);
    for (const v of u)
      if (v.endsWith(".json"))
        try {
          const a = JSON.parse(i.readFileSync(r.join(g, v), "utf8"));
          if (a.type === n) {
            const h = r.join(e.replace(/^~/, R.homedir()), a.localPath);
            i.existsSync(h) && s.push(a);
          }
        } catch {
        }
    return s;
  } catch (s) {
    return console.error("[Main] cache:list failed", s), [];
  }
});
let $ = "";
l.on("settings:update-download-path", (t, e) => {
  $ = e;
});
const L = r.dirname(ne(import.meta.url));
process.env.DIST = r.join(L, "../dist");
process.env.VITE_PUBLIC = w.isPackaged ? process.env.DIST : r.join(process.env.DIST, "../public");
let o = null, d = null, f = null, N = null, M = null, T = null, V = null, m = {
  isPlaying: !1,
  track: null
}, X = !0, q = !1;
function Q(t = !0) {
  const e = m.isPlaying ? "pause.png" : "play.png";
  M?.setImage(r.join(process.env.VITE_PUBLIC, e)), process.platform === "darwin" && t && (m.track ? T?.setTitle(`${m.track.name} - ${m.track.artist}`) : T?.setTitle(""));
  const n = [];
  m.track && n.push(
    { label: `♫ ${m.track.name}`, enabled: !1 },
    { label: `   ${m.track.artist}`, enabled: !1 },
    { type: "separator" },
    { label: "⏮ 上一曲", click: () => o?.webContents.send("player:prev") },
    {
      label: m.isPlaying ? "⏸ 暂停" : "▶️ 播放",
      click: () => o?.webContents.send("player:toggle")
    },
    { label: "⏭ 下一曲", click: () => o?.webContents.send("player:next") },
    { type: "separator" }
  ), n.push(
    { label: "打开播放器", click: () => o?.show() },
    { label: "退出", click: () => w.quit() }
  );
  const s = ee.buildFromTemplate(n);
  V?.setContextMenu(s);
}
l.on("player:update", (t, e) => {
  m = { ...m, ...e };
  const n = e.track !== void 0;
  Q(n), d?.webContents.send("player:update", e), f?.webContents.send("player:update", e);
});
l.on("settings:update-minimize-to-tray", (t, e) => {
  X = e;
});
l.on("lyric:update", (t, e) => {
  const { currentLyric: n } = e;
  if (process.platform === "darwin") {
    const s = n || (m.track ? `${m.track.name} - ${m.track.artist}` : "");
    T?.setTitle(s);
  }
  d?.webContents.send("lyric:update", e), f?.webContents.send("lyric:update", e);
});
l.on("lyric:settings-update", (t, e) => {
  d?.webContents.send("lyric:settings-update", e);
});
l.on("lyric:open", (t, e) => {
  le(e);
});
l.on("lyric:close", () => {
  d && (d.close(), d = null);
});
l.on("lyric:set-mouse-ignore", (t, e) => {
  d?.setIgnoreMouseEvents(e, { forward: !0 });
});
l.on("player:toggle", () => {
  console.log("Main process: received player:toggle"), o ? (console.log("Main process: forwarding player:toggle to main window"), o.webContents.send("player:toggle")) : console.warn("Main process: win is null, cannot forward player:toggle");
});
l.on("player:next", () => {
  console.log("Main process: received player:next"), o?.webContents.send("player:next");
});
l.on("player:prev", () => {
  o?.webContents.send("player:prev");
});
l.on("player:seek", (t, e) => {
  o?.webContents.send("player:seek", e);
});
l.on("window:set-mini", () => {
  o && (o.hide(), ie());
});
l.on("window:restore-main", () => {
  f && (f.close(), f = null), o && (o.show(), o.center());
});
l.on("app:show-main", () => {
  o && (o.isVisible() ? o.focus() : o.show());
});
l.on("window:set-always-on-top", (t, e) => {
  f && f.setAlwaysOnTop(e, "floating");
});
function ie() {
  if (f) {
    f.show();
    return;
  }
  f = new I({
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
    vibrancy: "popover",
    visualEffectState: "active",
    webPreferences: {
      contextIsolation: !0,
      nodeIntegration: !1,
      preload: r.join(L, "preload.mjs")
    }
  });
  const t = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/mini` : "app://./index.html#/mini";
  process.env.VITE_DEV_SERVER_URL, f.loadURL(t), process.platform === "darwin" && (f.setAlwaysOnTop(!0, "floating"), f.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 })), f.on("closed", () => {
    f = null;
  });
}
function Y() {
  o = new I({
    icon: r.join(process.env.VITE_PUBLIC, "logo.png"),
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
      preload: r.join(L, "preload.mjs")
    }
  }), o.on("close", (t) => (!q && X && (t.preventDefault(), o?.hide()), !1)), process.env.VITE_DEV_SERVER_URL ? o.loadURL(process.env.VITE_DEV_SERVER_URL) : o.loadURL("app://./index.html");
}
function le(t) {
  if (d) return;
  const { width: e, height: n } = Z.getPrimaryDisplay().workAreaSize, s = 800, u = 120, v = t?.x !== void 0 ? t.x : Math.floor((e - s) / 2), a = t?.y !== void 0 ? t.y : n - u - 50;
  d = new I({
    width: s,
    height: u,
    x: v,
    y: a,
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
      preload: r.join(L, "preload.mjs")
    }
  });
  const h = process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}#/lyric` : `${r.join(process.env.DIST, "index.html")}#/lyric`;
  process.env.VITE_DEV_SERVER_URL ? d.loadURL(h) : d.loadURL("app://./index.html#/lyric"), process.platform === "darwin" && (d.setAlwaysOnTop(!0, "screen-saver"), d.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }));
  let c = null;
  d.on("move", () => {
    c && clearTimeout(c), c = setTimeout(() => {
      if (d && o) {
        const [p, b] = d.getPosition();
        o.webContents.send("lyric:position-updated", { x: p, y: b });
      }
    }, 500);
  }), d.on("closed", () => {
    d = null;
  });
}
function ce() {
  const t = (e, n = 20) => te.createFromPath(r.join(process.env.VITE_PUBLIC, e)).resize({ width: n, height: n });
  T = new j(t("next.png")), M = new j(t("play.png")), N = new j(t("previous.png")), V = new j(t("mini_logo.png")), T.on("click", () => {
    o?.webContents.send("player:next");
  }), M.on("click", () => {
    o?.webContents.send("player:toggle");
  }), N.on("click", () => {
    o?.webContents.send("player:prev");
  }), V.on("click", () => {
    o && (o.isVisible() ? o.focus() : o.show());
  }), Q();
}
w.on("before-quit", () => {
  q = !0;
});
U.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: !0,
      secure: !0,
      supportFetchAPI: !0,
      bypassCSP: !1,
      corsEnabled: !0
    }
  },
  {
    scheme: "media",
    privileges: {
      standard: !0,
      secure: !0,
      supportFetchAPI: !0,
      bypassCSP: !0,
      corsEnabled: !0,
      // often needed for media elements
      stream: !0
    }
  }
]);
w.whenReady().then(() => {
  console.log("[Main] App is ready."), console.log(`[Main] CACHE_DIR set to: ${g}`), console.log(`[Main] Initial Download Path: ${$ || "Default (app/downloads)"}`), U.handle("app", (t) => {
    try {
      const e = new URL(t.url);
      let n = decodeURIComponent(e.pathname);
      n.startsWith("/") && (n = n.slice(1));
      const s = r.join(process.env.DIST, n || "index.html");
      return console.log(`[Main] App Protocol: url=${t.url} -> filePath=${s}`), k.fetch(B(s).href);
    } catch (e) {
      return console.error("[Main] App protocol error:", e), new Response("Internal error", { status: 500 });
    }
  }), U.handle("media", async (t) => {
    try {
      const e = new URL(t.url), n = e.host;
      let s = e.pathname;
      s.startsWith("/") && (s = s.slice(1));
      const u = decodeURIComponent(s);
      let a = ((y, P) => {
        if (y === "audio") {
          const C = $ || r.join(w.getPath("userData"), "downloads");
          return r.join(C.replace(/^~/, R.homedir()), P);
        } else {
          if (y === "cover" || y === "metadata")
            return r.join(g, P);
          {
            const C = $ || r.join(w.getPath("userData"), "audio_cache");
            return r.join(C.replace(/^~/, R.homedir()), y, P);
          }
        }
      })(n, u);
      if (!i.existsSync(a)) {
        const y = r.join(g, u || n);
        i.existsSync(y) && (console.log(`[Main] File found via CACHEFallback: ${y}`), a = y);
      }
      const h = i.existsSync(a);
      if (console.log(`[Main] Media Protocol: url=${t.url} -> host=${n}, path=${u} -> filePath=${a} (exists: ${h})`), !h)
        return new Response("File Not Found", { status: 404 });
      const c = r.extname(a).toLowerCase();
      let p = "application/octet-stream";
      if (c === ".jpg" || c === ".jpeg" ? p = "image/jpeg" : c === ".png" ? p = "image/png" : c === ".mp3" ? p = "audio/mpeg" : c === ".flac" ? p = "audio/flac" : c === ".wav" ? p = "audio/wav" : c === ".aac" ? p = "audio/aac" : c === ".json" && (p = "application/json"), c === ".m4a") {
        if (await ae(a) === "alac") {
          console.log(`[Main] Detected ALAC codec for ${a}, transcoding to WAV...`);
          const P = H("ffmpeg", ["-i", a, "-f", "wav", "-"]);
          return new Response(J.toWeb(P.stdout), {
            headers: {
              "Content-Type": "audio/wav",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        }
        p = "audio/mp4";
      }
      if (n === "cover" || n === "metadata" || c === ".json" || c === ".jpeg" || c === ".jpg" || c === ".png") {
        const y = i.readFileSync(a);
        return new Response(y, {
          headers: {
            "Content-Type": p,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
          }
        });
      }
      const b = B(a).href, S = await k.fetch(b);
      return new Response(S.body, {
        status: S.status,
        statusText: S.statusText,
        headers: {
          "Content-Type": p,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        }
      });
    } catch (e) {
      return console.error("[Main] Protocol handle error:", e), new Response("Internal error", { status: 500 });
    }
  }), Y(), ce();
});
w.on("window-all-closed", () => {
  process.platform !== "darwin" && w.quit();
});
w.on("activate", () => {
  I.getAllWindows().length === 0 ? Y() : o?.show();
});
