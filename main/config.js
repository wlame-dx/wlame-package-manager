// Uygulama genelinde sabit ayarlar.
// Kullanıcının kendi repoları (kendi hesabı) burada tutulur.
module.exports = {
  owner: 'wlame-dx',
  appName: 'WLAME Hub',
  // Katalog için taranan repo türleri
  catalog: {
    includeForks: false,
    includeArchived: false,
    // Sadece release'i .exe içeren repolar "indirilebilir" sayılır
    exeExtensions: ['.exe'],
  },
  updateCheckIntervalMs: 30 * 60 * 1000, // 30 dakikada bir güncelleme kontrolü
  githubApiBase: 'https://api.github.com',
  userAgent: 'wlame-package-manager',
};
