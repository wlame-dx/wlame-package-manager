// github.js birim testleri
const test = require('node:test');
const assert = require('node:assert');
const gh = require('../main/github');

const exe = (name, size = 1000) => ({ name, size, browser_download_url: `https://x/${name}`, download_count: 1 });
const rel = (assets) => ({ tag_name: 'v1.0.0', assets });

test('isExeAsset sadece .exe kabul eder', () => {
  assert.strictEqual(gh.isExeAsset(exe('Setup.exe')), true);
  assert.strictEqual(gh.isExeAsset(exe('PORTABLE.EXE')), true);
  assert.strictEqual(gh.isExeAsset(exe('app.zip')), false);
  assert.strictEqual(gh.isExeAsset(exe('readme.txt')), false);
  assert.strictEqual(gh.isExeAsset({ name: 'no-extension' }), false);
});

test('exeAssetsOf filtreler', () => {
  const assets = [exe('a.exe'), exe('b.zip'), exe('c.msi')];
  assert.strictEqual(gh.exeAssetsOf(rel(assets)).length, 1);
  assert.strictEqual(gh.exeAssetsOf(rel([])).length, 0);
  assert.strictEqual(gh.exeAssetsOf(null).length, 0);
});

test('isDownloadableRelease', () => {
  assert.strictEqual(gh.isDownloadableRelease(rel([exe('a.exe')])), true);
  assert.strictEqual(gh.isDownloadableRelease(rel([exe('a.zip')])), false);
  assert.strictEqual(gh.isDownloadableRelease(null), false);
});

test('downloadableReleases listeyi süzer', () => {
  const releases = [rel([exe('a.exe')]), rel([exe('a.zip')]), rel([])];
  assert.strictEqual(gh.downloadableReleases(releases).length, 1);
  assert.strictEqual(gh.downloadableReleases(null).length, 0);
});

test('releaseIsNewer semver karşılaştırması', () => {
  assert.strictEqual(gh.releaseIsNewer('v1.1.0', 'v1.0.0'), true);
  assert.strictEqual(gh.releaseIsNewer('v1.0.0', 'v1.1.0'), false);
  assert.strictEqual(gh.releaseIsNewer('v2.0.0', 'v1.9.9'), true);
  assert.strictEqual(gh.releaseIsNewer('v1.0.0', 'v1.0.0'), false);
  assert.strictEqual(gh.releaseIsNewer('1.0.10', '1.0.9'), true);
});

test('releaseIsNewer uç durumlar', () => {
  assert.strictEqual(gh.releaseIsNewer('v1.0.0', null), true);  // kurulmamışsa her şey yeni
  assert.strictEqual(gh.releaseIsNewer(null, 'v1.0.0'), false);
  assert.strictEqual(gh.releaseIsNewer('nightly', 'v1.0.0'), false); // karşılaştırılamıyorsa indirme
  assert.strictEqual(gh.releaseIsNewer('abc', 'def'), false);
});

test('logoUrl opengraph adresi üretir', () => {
  const repo = { full_name: 'wlame-dx/umbra' };
  assert.strictEqual(gh.logoUrl(repo), 'https://opengraph.githubassets.com/1/wlame-dx/umbra');
});
