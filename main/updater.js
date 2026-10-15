// Otomatik güncelleme: kurulu uygulamaların son release'lerini kontrol eder,
// yeni sürüm varsa (ayarlaysa) sessizce indirir ve bildirim üretir.
const github = require('./github');

/**
 * @param {{listInstalled:()=>Array}} store
 * @param {(job:{entry:object,newTag:string,exeAsset:object})=>Promise<string>} doDownload
 *        updater'ın indirme yapması için geri çağrısı (main tarafından verilir)
 * @param {(note:{title:string,body:string,entry:object,newTag:string,file?:string})=>void} notify
 * @param {{autoDownload:boolean}} options
 * @returns {Promise<Array>} yapılan işlerin listesi
 */
async function checkForUpdates(store, doDownload, notify, options = {}) {
  const autoDownload = options.autoDownload !== false;
  const installed = store.listInstalled();
  const results = [];

  for (const entry of installed) {
    let latest;
    try {
      latest = await github.api(`/repos/${entry.fullName}/releases/latest`).catch((e) => {
        if (e.status === 404) return null;
        throw e;
      });
    } catch (e) {
      results.push({ fullName: entry.fullName, error: e.message });
      continue;
    }
    if (!latest) continue;
    if (!github.releaseIsNewer(latest.tag_name, entry.tag)) continue;

    const exes = github.exeAssetsOf(latest);
    if (exes.length === 0) continue;

    // Kurulumda seçilen asset adı hâlâ varsa onu, yoksa ilk .exe'yi indir
    const asset = exes.find((a) => a.name === entry.assetName) || exes[0];
    const result = { fullName: entry.fullName, oldTag: entry.tag, newTag: latest.tag_name, asset: asset.name };

    if (autoDownload && doDownload) {
      try {
        const file = await doDownload({ entry, newTag: latest.tag_name, exeAsset: asset });
        result.file = file;
        store.upsertInstalled({ fullName: entry.fullName, tag: latest.tag_name, assetName: asset.name });
        notify({
          title: 'Güncelleme indirildi',
          body: `${entry.name}: ${entry.tag} → ${latest.tag_name} (${asset.name}) indirildi.`,
          entry,
          newTag: latest.tag_name,
          file,
        });
      } catch (e) {
        result.error = e.message;
        notify({
          title: 'Güncelleme indirilemedi',
          body: `${entry.name}: ${e.message}`,
          entry,
          newTag: latest.tag_name,
        });
      }
    } else {
      notify({
        title: 'Güncelleme mevcut',
        body: `${entry.name}: ${entry.tag} → ${latest.tag_name}`,
        entry,
        newTag: latest.tag_name,
      });
    }
    results.push(result);
  }
  return results;
}

module.exports = { checkForUpdates };
