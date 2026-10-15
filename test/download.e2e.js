// Gerçek ağ üzerinden indirme motoru testi (küçük bir .exe ile).
const os = require('os');
const path = require('path');
const fs = require('fs');
const gh = require('../main/github');
const { downloadFile, defaultDownloadDir } = require('../main/downloader');

(async () => {
  const rel = await gh.api('/repos/wlame-dx/umbra/releases/latest');
  const exe = gh.exeAssetsOf(rel);
  console.log(`Release: ${rel.tag_name}, .exe sayısı: ${exe.length}`);
  if (!exe.length) throw new Error('Test için .exe bulunamadı');
  const asset = { ...exe[0], url: gh.exeAssetsOf(rel)[0].browser_download_url };
  // Not: katalog da browser_download_url kullanır; API asset URL'i de desteklenir.
  console.log(`İndiriliyor: ${asset.name} (${(asset.size / 1024).toFixed(0)} KB)`);

  const dest = path.join(os.tmpdir(), 'wlame-dl-test', asset.name);
  let last = -1;
  await downloadFile(asset.url, dest, (p) => {
    const step = Math.floor(p.percent / 25);
    if (step !== last) {
      last = step;
      console.log(`  %${Math.round(p.percent)}`);
    }
  });

  const st = fs.statSync(dest);
  console.log(`İndirilen boyut: ${st.size} bayt`);
  // MZ imzası (Windows PE dosyası kontrolü)
  const head = Buffer.alloc(2);
  const fd = fs.openSync(dest, 'r');
  fs.readSync(fd, head, 0, 2, 0);
  fs.closeSync(fd);
  const isPE = head[0] === 0x4d && head[1] === 0x5a; // "MZ"
  console.log(`PE imzası (MZ): ${isPE ? 'EVET' : 'HAYIR'}`);
  if (st.size !== asset.size) throw new Error(`Boyut uyuşmuyor: ${st.size} != ${asset.size}`);
  if (!isPE) throw new Error('İndirilen dosya geçerli bir .exe değil');
  fs.rmSync(path.dirname(dest), { recursive: true, force: true });
  console.log('DOWNLOAD E2E OK (temizlendi)');
  console.log('Varsayılan indirme klasörü olurdu:', defaultDownloadDir());
})().catch((e) => {
  console.error('DOWNLOAD E2E FAIL:', e.message);
  process.exit(1);
});
