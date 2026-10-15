// store.js birim testleri (geçici dosyada)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../main/store');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-')), 'installed.json');
}

test('boş store okunur', () => {
  const s = new Store(tmpFile());
  assert.deepStrictEqual(s.listInstalled(), []);
});

test('upsert + list + remove', () => {
  const f = tmpFile();
  const s = new Store(f);
  s.upsertInstalled({ fullName: 'wlame-dx/umbra', name: 'Umbra', tag: 'v1.0.0', assetName: 'Umbra.exe' });
  s.upsertInstalled({ fullName: 'wlame-dx/web', name: 'Web', tag: 'v0.2.0' });
  assert.strictEqual(s.listInstalled().length, 2);

  s.upsertInstalled({ fullName: 'wlame-dx/umbra', tag: 'v1.1.0' });
  const u = s.getInstalled('wlame-dx/umbra');
  assert.strictEqual(u.tag, 'v1.1.0');
  assert.strictEqual(u.assetName, 'Umbra.exe'); // diğer alanlar korunur
  assert.ok(u.installedAt);

  s.removeInstalled('wlame-dx/web');
  assert.strictEqual(s.listInstalled().length, 1);

  // kalıcılık: yeni instance aynı veriyi görür
  const s2 = new Store(f);
  assert.strictEqual(s2.listInstalled().length, 1);
  assert.strictEqual(s2.getInstalled('wlame-dx/umbra').tag, 'v1.1.0');
});

test('ayarlar kalıcı ve merge olur', () => {
  const f = tmpFile();
  const s = new Store(f);
  assert.deepStrictEqual(s.getSettings(), { autostart: true, autoDownloadUpdates: true });
  s.setSettings({ autostart: false });
  const s2 = new Store(f);
  assert.strictEqual(s2.getSettings().autostart, false);
  assert.strictEqual(s2.getSettings().autoDownloadUpdates, true);
});
