// downloader.js birim testleri (ağ gerektirmeyen kısım)
const test = require('node:test');
const assert = require('node:assert');
const { humanSize, safeFileName, defaultDownloadDir } = require('../main/downloader');

test('humanSize biçimlendirir', () => {
  assert.strictEqual(humanSize(0), '0 B');
  assert.strictEqual(humanSize(999), '999 B');
  assert.strictEqual(humanSize(1024), '1.0 KB');
  assert.strictEqual(humanSize(1536), '1.5 KB');
  assert.strictEqual(humanSize(1024 * 1024 * 5), '5.0 MB');
  assert.strictEqual(humanSize(NaN), '?');
});

test('safeFileName geçersiz karakterleri temizler', () => {
  assert.strictEqual(safeFileName('a<b>c:"d|e?f*g.exe'), 'a_b_c__d_e_f_g.exe');
  assert.strictEqual(safeFileName('normal-name_v1.0.exe'), 'normal-name_v1.0.exe');
  assert.ok(!safeFileName('C:\\path\\x.exe').includes('\\'));
});

test('defaultDownloadDir Downloads/WLAME Hub hedefler', () => {
  const p = defaultDownloadDir();
  assert.ok(p.includes('Downloads'));
  assert.ok(p.endsWith('WLAME Hub'));
});
