// WLAME Hub — ana süreç (Electron main).
const { app, BrowserWindow, ipcMain, Notification, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const github = require('./github');
const { Store } = require('./store');
const { downloadFile, humanSize, safeFileName, defaultDownloadDir } = require('./downloader');
const updater = require('./updater');

const SMOKE = process.argv.includes('--smoke'); // test modu: pencereyi hemen kapat

let win = null;
let tray = null;
let store = null;
let updateTimer = null;
let catalogCache = null;

/* ---------- katalog önbelleği (limit dolarsa son liste gösterilir) ---------- */
function catalogCachePath() {
  return path.join(app.getPath('userData'), 'catalog.json');
}

function readCatalogCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(catalogCachePath(), 'utf8'));
    if (Array.isArray(raw.apps) && raw.apps.length) return raw;
  } catch (_) {}
  return null;
}

function writeCatalogCache(apps) {
  try {
    fs.writeFileSync(catalogCachePath(), JSON.stringify({ at: Date.now(), apps }), 'utf8');
  } catch (_) {}
}

async function loadCatalog(force = false) {
  if (!force && catalogCache) return { apps: catalogCache, stale: false };
  try {
    catalogCache = await github.buildCatalog();
    writeCatalogCache(catalogCache);
    return { apps: catalogCache, stale: false };
  } catch (e) {
    const cached = readCatalogCache();
    if (cached) {
      catalogCache = cached.apps;
      return {
        apps: cached.apps,
        stale: true,
        at: cached.at,
        rateLimited: !!e.rateLimited,
        error: e.message,
      };
    }
    throw e;
  }
}

/* ---------- pencere ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#101012',
    title: config.appName,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function notify(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title: `${config.appName} — ${title}`, body }).show();
  }
}

/* ---------- otomatik başlatma (Windows) ---------- */
function applyAutostart(enabled) {
  if (process.platform !== 'win32') return;
  const exe = process.execPath;
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: exe,
    args: process.argv.slice(1).concat(['--background']),
  });
}

/* ---------- güncelleme kontrolü ---------- */
async function runUpdateCheck(showToasts = true) {
  const settings = store.getSettings();
  try {
    const jobs = await updater.checkForUpdates(
      store,
      async ({ entry, exeAsset }) => {
        const dir = path.join(defaultDownloadDir(), '_updates');
        const dest = path.join(dir, `${safeFileName(entry.name)}_${safeFileName(exeAsset.name)}`);
        await downloadFile(exeAsset.url, dest);
        return dest;
      },
      (note) => {
        if (showToasts) notify(note.title, note.body);
        send('update-notification', { ...note, at: new Date().toISOString() });
      },
      { autoDownload: settings.autoDownloadUpdates }
    );
    return jobs;
  } catch (e) {
    if (showToasts) notify('Güncelleme kontrolü hatası', e.message);
    return { error: e.message };
  }
}

function scheduleUpdateChecks() {
  if (updateTimer) clearInterval(updateTimer);
  // başlatıldıktan 20 sn sonra ilk kontrol, sonra periyodik
  setTimeout(() => runUpdateCheck(true), 20 * 1000);
  updateTimer = setInterval(() => runUpdateCheck(true), config.updateCheckIntervalMs);
}

/* ---------- IPC ---------- */
function registerIpc() {
  ipcMain.handle('catalog:list', () => loadCatalog(false));

  ipcMain.handle('catalog:refresh', () => loadCatalog(true));

  ipcMain.handle('releases:list', (_e, fullName) => github.listReleases(fullName));

  ipcMain.handle('readme:get', (_e, fullName) => github.getReadme(fullName));

  // İndirme: 2+ .exe varsa renderer seçenek ekranı gösterir ve assetName gönderir
  ipcMain.handle('download:start', async (_e, { fullName, name, tag, assetUrl, assetName, logo, description }) => {
    if (!assetUrl) throw new Error('İndirilecek dosya belirtilmedi.');
    const dir = defaultDownloadDir();
    const dest = path.join(dir, safeFileName(assetName || path.basename(new URL(assetUrl).pathname)));
    const id = `${fullName}@${Date.now()}`;

    // ilerlemeyi ayrı ayrı gönder
    downloadFile(assetUrl, dest, (p) =>
      send('download:progress', {
        id,
        fullName,
        assetName: assetName,
        percent: Math.round(p.percent),
        received: p.received,
        total: p.total,
        human: `${humanSize(p.received)} / ${humanSize(p.total)}`,
      })
    )
      .then(() => {
        store.upsertInstalled({
          fullName,
          name: name || fullName.split('/')[1],
          tag,
          assetName,
          filePath: dest,
          logo,
          description,
        });
        // İndirme bitince doğrudan çalıştır (ayar açıksa)
        const settings = store.getSettings();
        const autoRun = settings.autoRun !== false && /\.exe$/i.test(dest);
        if (autoRun) {
          shell.openPath(dest).then((err) => {
            if (err) notify('Uygulama başlatılamadı', err);
          });
          notify('İndirme tamamlandı', `${assetName} indirildi ve başlatıldı.`);
        } else {
          notify('İndirme tamamlandı', `${assetName} indirildi.`);
        }
        send('download:done', { id, fullName, file: dest, launched: autoRun });
      })
      .catch((e) => send('download:error', { id, fullName, error: e.message }));

    return { id, dir };
  });

  ipcMain.handle('download:pickFolder', async () => {
    const { dialog } = require('electron');
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('shell:open', (_e, p) => shell.openPath(p));
  ipcMain.handle('shell:run', (_e, p) => shell.openPath(p));
  ipcMain.handle('shell:showItem', (_e, p) => {
    shell.showItemInFolder(p);
    return true;
  });
  ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));

  ipcMain.handle('installed:list', () => store.listInstalled());
  ipcMain.handle('installed:remove', (_e, fullName) => {
    store.removeInstalled(fullName);
    return store.listInstalled();
  });

  ipcMain.handle('settings:get', () => {
    const s = store.getSettings();
    applyAutostart(s.autostart);
    return { ...s, appName: config.appName, owner: config.owner, downloadDir: defaultDownloadDir() };
  });
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = store.setSettings(patch);
    applyAutostart(s.autostart);
    if ('token' in patch) {
      github.setToken(patch.token);
      catalogCache = null; // token değişince katalog yeniden çekilsin
    }
    return s;
  });

  ipcMain.handle('updates:check', () => runUpdateCheck(true));

  ipcMain.handle('app:info', () => ({
    name: config.appName,
    version: app.getVersion(),
    owner: config.owner,
  }));

  // Pencere kontrolleri (çerçevesiz his için sadece minimize/close yeterli)
  ipcMain.on('win:minimize', () => win && win.minimize());
  ipcMain.on('win:close', () => win && win.close());
}

/* ---------- tray ---------- */
function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'renderer', 'assets', 'tray.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(nativeImage.createFromPath(iconPath));
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: `${config.appName} aç`, click: () => (win ? win.show() : createWindow()) },
          { label: 'Şimdi güncelleme kontrolü', click: () => runUpdateCheck(true) },
          { type: 'separator' },
          { label: 'Çıkış', click: () => app.quit() },
        ])
      );
      tray.setToolTip(`${config.appName} — arka planda çalışıyor`);
      tray.on('click', () => (win ? win.show() : createWindow()));
    }
  } catch (e) {
    console.error('Tray oluşturulamadı:', e.message);
  }
}

/* ---------- yaşam döngüsü ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
    }
  });

  app.whenReady().then(() => {
    store = new Store();
    const settings = store.getSettings();
    github.setToken(settings.token); // opsiyonel: ayarlardan token
    applyAutostart(settings.autostart);
    registerIpc();
    createWindow();
    createTray();

    // --background ile başladıysa (otomatik başlatma) pencereyi gizle
    if (process.argv.includes('--background') && win) {
      win.hide();
    }

    scheduleUpdateChecks();

    if (SMOKE) {
      // Smoke test: pencere + renderer hatasız yüklenmeden çıkma
      let errors = [];
      win.webContents.on('console-message', (_e, level, message) => {
        console.log(`[renderer:${level}] ${message}`);
        if (level >= 3) errors.push(message); // 3 = error seviyesi
      });
      win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          if (errors.length) {
            console.error('SMOKE FAIL: renderer hataları:\n' + errors.join('\n'));
            process.exitCode = 1;
          } else {
            console.log('SMOKE OK: pencere ve renderer hatasız yüklendi');
          }
          app.quit();
        }, 6000);
      });
      win.webContents.once('did-fail-load', (_e, code, desc) => {
        console.error(`SMOKE FAIL: sayfa yüklenemedi: ${code} ${desc}`);
        process.exitCode = 1;
        app.quit();
      });
    }
  });

  app.on('window-all-closed', () => {
    // Tray'de kalmaya devam et (Windows kapanışta değil)
    if (process.platform !== 'win32') app.quit();
  });

  app.on('before-quit', () => {
    if (updateTimer) clearInterval(updateTimer);
  });
}
