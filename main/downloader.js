// .exe indirme motoru — progress olayları üretir.
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

/** 1234 -> "1.2 MB" */
function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function safeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

/**
 * URL'den dosya indirir.
 * @param {string} url indirme adresi
 * @param {string} destPath hedef dosya yolu
 * @param {(progress:{percent:number,received:number,total:number})=>void} onProgress
 * @returns {Promise<string>} hedef yol
 */
async function downloadFile(url, destPath, onProgress) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'wlame-package-manager' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`İndirme başarısız: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.part`;
  let received = 0;

  const out = fs.createWriteStream(tmp);
  const tracked = new Readable({
    read() {},
  });
  // kaynak stream'i sar: okunan her parçayı sayaçla ilet
  const src = Readable.fromWeb(res.body);
  src.on('data', (chunk) => {
    received += chunk.length;
    if (onProgress) {
      onProgress({
        percent: total ? Math.min(100, (received / total) * 100) : 0,
        received,
        total,
      });
    }
    tracked.push(chunk);
  });
  src.on('end', () => tracked.push(null));
  src.on('error', (e) => tracked.destroy(e));

  try {
    await pipeline(tracked, out);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    throw e;
  }
  fs.renameSync(tmp, destPath);
  if (onProgress) onProgress({ percent: 100, received, total });
  return destPath;
}

/** İndirilecek varsayılan klasör: Kullanıcı/Downloads/WLAME Hub */
function defaultDownloadDir() {
  const home = process.env.USERPROFILE || process.env.HOME || __dirname;
  return path.join(home, 'Downloads', 'WLAME Hub');
}

module.exports = { downloadFile, humanSize, safeFileName, defaultDownloadDir };
