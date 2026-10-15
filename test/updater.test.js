// updater.js birim testleri — github.api sahtelenir (ağ yok)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const github = require('../main/github');
const { Store } = require('../main/store');
const updater = require('../main/updater');

function makeStore(entries) {
  const s = new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-')), 'i.json'));
  entries.forEach((e) => s.upsertInstalled(e));
  return s;
}

// github.api'yı sahtele
const realApi = github.api;
function fakeApi(map) {
  github.api = async (p) => {
    if (map[p] !== undefined) {
      if (map[p] === '__404__') {
        const e = new Error('404');
        e.status = 404;
        throw e;
      }
      return map[p];
    }
    const e = new Error('404');
    e.status = 404;
    throw e;
  };
}
test.afterEach(() => {
  github.api = realApi;
});

const exe = (name) => ({ name, size: 1, browser_download_url: `https://x/${name}` });
const release = (tag, assets) => ({ tag_name: tag, assets });

test('güncelleme yoksa hiçbir şey yapmaz', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/umbra', name: 'Umbra', tag: 'v1.0.0', assetName: 'a.exe' }]);
  fakeApi({ '/repos/wlame-dx/umbra/releases/latest': release('v1.0.0', [exe('a.exe')]) });
  const notes = [];
  const res = await updater.checkForUpdates(store, async () => assert.fail('indirme yapılmamalı'), (n) => notes.push(n));
  assert.strictEqual(res.length, 0);
  assert.strictEqual(notes.length, 0);
});

test('yeni sürüm varsa otomatik indirir, bildirir ve kaydı günceller', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/umbra', name: 'Umbra', tag: 'v1.0.0', assetName: 'a.exe' }]);
  fakeApi({ '/repos/wlame-dx/umbra/releases/latest': release('v1.2.0', [exe('a.exe')]) });
  const notes = [];
  let downloaded = null;
  const res = await updater.checkForUpdates(
    store,
    async ({ entry, exeAsset }) => {
      downloaded = { entry, exeAsset };
      return 'C:/tmp/a.exe';
    },
    (n) => notes.push(n),
    { autoDownload: true }
  );
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].newTag, 'v1.2.0');
  assert.ok(downloaded, 'indirme çağrısı yapılmalı');
  assert.strictEqual(downloaded.exeAsset.name, 'a.exe');
  assert.strictEqual(notes.length, 1);
  assert.match(notes[0].title, /indirildi/);
  assert.strictEqual(store.getInstalled('wlame-dx/umbra').tag, 'v1.2.0');
});

test('autoDownload kapalıysa sadece bildirir', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/umbra', name: 'Umbra', tag: 'v1.0.0', assetName: 'a.exe' }]);
  fakeApi({ '/repos/wlame-dx/umbra/releases/latest': release('v2.0.0', [exe('a.exe')]) });
  const notes = [];
  const res = await updater.checkForUpdates(store, async () => assert.fail('indirme yapılmamalı'), (n) => notes.push(n), {
    autoDownload: false,
  });
  assert.strictEqual(res.length, 1);
  assert.strictEqual(notes.length, 1);
  assert.match(notes[0].title, /mevcut/);
  assert.strictEqual(store.getInstalled('wlame-dx/umbra').tag, 'v1.0.0'); // değişmedi
});

test('kurulumdaki asset adı yoksa ilk .exe indirilir', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/x', name: 'X', tag: 'v1.0.0', assetName: 'eski.exe' }]);
  fakeApi({ '/repos/wlame-dx/x/releases/latest': release('v1.1.0', [exe('yeni.exe'), exe('b.exe')]) });
  let got = null;
  await updater.checkForUpdates(
    store,
    async ({ exeAsset }) => {
      got = exeAsset.name;
      return 'f';
    },
    () => {},
    { autoDownload: true }
  );
  assert.strictEqual(got, 'yeni.exe');
});

test('release 404 ise sessiz geçer', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/gone', name: 'Gone', tag: 'v1.0.0' }]);
  fakeApi({ '/repos/wlame-dx/gone/releases/latest': '__404__' });
  const res = await updater.checkForUpdates(store, async () => {}, () => {});
  assert.strictEqual(res.length, 0);
});

test('release .exe içermiyorsa indirmez', async () => {
  const store = makeStore([{ fullName: 'wlame-dx/y', name: 'Y', tag: 'v1.0.0', assetName: 'a.exe' }]);
  fakeApi({ '/repos/wlame-dx/y/releases/latest': release('v2.0.0', [{ name: 'a.zip' }]) });
  const res = await updater.checkForUpdates(store, async () => assert.fail('exe yokken indirme olmaz'), () => {});
  assert.strictEqual(res.length, 0);
});
