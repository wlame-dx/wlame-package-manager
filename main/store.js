// Kurulu uygulamalar kayıt defteri (userData/installed.json).
// Electron bağımlılığı yok — test için dosya yolu dışarıdan verilir.
const fs = require('fs');
const path = require('path');

function defaultFile() {
  // Electron yoksa yerel .data dizini kullanılır (testler).
  try {
    const { app } = require('electron');
    if (app) return path.join(app.getPath('userData'), 'installed.json');
  } catch (_) {
    /* electron yok — test modu */
  }
  return path.join(__dirname, '..', '.data', 'installed.json');
}

class Store {
  constructor(file = defaultFile()) {
    this.file = file;
    this.data = { installed: {}, settings: { autostart: true, autoDownloadUpdates: true, autoRun: true } };
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      this.data = Object.assign(this.data, JSON.parse(raw));
      if (!this.data.installed) this.data.installed = {};
      if (!this.data.settings) this.data.settings = {};
    } catch (_) {
      /* ilk çalıştırmada dosya yok */
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  listInstalled() {
    return Object.values(this.data.installed);
  }

  getInstalled(fullName) {
    return this.data.installed[fullName] || null;
  }

  upsertInstalled(entry) {
    // entry: { fullName, name, tag, assetName, filePath, version, installedAt, logo, description }
    this.data.installed[entry.fullName] = Object.assign(
      { installedAt: new Date().toISOString() },
      this.data.installed[entry.fullName],
      entry
    );
    this.save();
    return this.data.installed[entry.fullName];
  }

  removeInstalled(fullName) {
    delete this.data.installed[fullName];
    this.save();
  }

  getSettings() {
    return Object.assign({ autostart: true, autoDownloadUpdates: true, autoRun: true }, this.data.settings);
  }

  setSettings(patch) {
    this.data.settings = Object.assign(this.getSettings(), patch);
    this.save();
    return this.data.settings;
  }
}

module.exports = { Store, defaultFile };
