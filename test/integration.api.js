// Gerçek GitHub API ile katalog bütünleşik testi (ağ gerekir, rate limit'e dikkat).
const gh = require('../main/github');

(async () => {
  console.log(`Katalog çekiliyor: github.com/${require('../main/config').owner}...`);
  const catalog = await gh.buildCatalog();
  console.log(`Repo sayısı: ${catalog.length}`);
  for (const c of catalog) {
    console.log(
      ` - ${c.fullName.padEnd(24)} downloadable=${String(c.downloadable).padEnd(5)} tag=${c.latestTag || '-'} exes=${c.exeAssets.length} logo=${c.logo}`
    );
    if (c.releaseError) console.log(`   error: ${c.releaseError}`);
  }
  const dl = catalog.filter((c) => c.downloadable);
  console.log(`İndirilebilir (.exe'li): ${dl.length}`);

  // 2+ exe senaryosu var mı bak (çoklu seçim akışı için)
  const multi = catalog.filter((c) => c.exeAssets.length >= 2);
  console.log(`2+ exe içeren release: ${multi.length}`);

  if (catalog.length === 0) throw new Error('Katalog boş!');
  // Başarı ölçütü: API çağrısı hatasız, yapı tutarlı
  for (const c of catalog) {
    if (!c.fullName || !c.logo) throw new Error('Kart şeması hatalı: ' + JSON.stringify(c));
  }
  console.log('INTEGRATION OK');
  process.exit(0);
})().catch((e) => {
  console.error('INTEGRATION FAIL:', e);
  process.exit(1);
});
