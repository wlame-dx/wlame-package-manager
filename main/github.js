// GitHub API katmanı — saf, Electron'a bağlı değil (test edilebilir).
const config = require('./config');

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': config.userAgent,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Opsiyonel token (rate limit için)
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function api(path) {
  const res = await fetch(`${config.githubApiBase}${path}`, { headers: headers() });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Kullanıcının (owner) herkese açık repolarını çeker. */
async function listRepos() {
  const repos = await api(`/users/${config.owner}/repos?per_page=100&sort=updated`);
  return repos
    .filter((r) => !r.fork || config.catalog.includeForks)
    .filter((r) => !r.archived || config.catalog.includeArchived);
}

/** Bir asset'in indirilebilir .exe olup olmadığı. */
function isExeAsset(asset) {
  const name = (asset.name || '').toLowerCase();
  return config.catalog.exeExtensions.some((ext) => name.endsWith(ext));
}

/** Bir release'ten indirilebilir .exe asset'lerini seçer. */
function exeAssetsOf(release) {
  if (!release || !Array.isArray(release.assets)) return [];
  return release.assets.filter(isExeAsset);
}

/** Bir release'in etiketi indirilebilir mi (içinde .exe var mı)? */
function isDownloadableRelease(release) {
  return exeAssetsOf(release).length > 0;
}

/** Tek sayfalık release listesinden indirilebilir olanları seçer. */
function downloadableReleases(releases) {
  return (releases || []).filter(isDownloadableRelease);
}

/** Repo'nun logosu: GitHub OpenGraph görseli (repo açıklamasına/README'ye göre üretilir). */
function logoUrl(repo) {
  return `https://opengraph.githubassets.com/1/${repo.full_name}`;
}

/** Basit release karşılaştırması: tag'ler (v)X.Y.Z ise sayısal, değilse tarihe göre. */
function releaseIsNewer(candidateTag, installedTag) {
  if (!candidateTag) return false;
  if (!installedTag) return true;
  if (candidateTag === installedTag) return false;
  const parse = (t) => {
    const m = String(t).match(/(\d+)\.?(\d+)?\.?(\d+)?/);
    return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : null;
  };
  const a = parse(candidateTag);
  const b = parse(installedTag);
  if (a && b) {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }
  return false; // karşılaştırılamıyorsa sessiz güncelleme yapma
}

/** Tam katalog: repolar + son release + logo + indirilebilirlik. */
async function buildCatalog() {
  const repos = await listRepos();
  const catalog = await Promise.all(
    repos.map(async (repo) => {
      let release = null;
      let exeAssets = [];
      let releaseError = null;
      try {
        release = await api(`/repos/${repo.full_name}/releases/latest`).catch((e) => {
          if (e.status === 404) return null; // release'i olmayan repo
          throw e;
        });
        exeAssets = exeAssetsOf(release);
      } catch (e) {
        releaseError = e.message;
      }
      return {
        fullName: repo.full_name,
        name: repo.name,
        description: repo.description || '',
        homepage: repo.homepage || '',
        topics: repo.topics || [],
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        logo: logoUrl(repo),
        htmlUrl: repo.html_url,
        latestTag: release ? release.tag_name : null,
        latestName: release ? release.name : null,
        publishedAt: release ? release.published_at : null,
        // İndirilebilirlik: son release'te .exe varsa true
        downloadable: exeAssets.length > 0,
        exeAssets: exeAssets.map((a) => ({
          name: a.name,
          size: a.size,
          url: a.browser_download_url,
          downloads: a.download_count,
        })),
        releaseError,
      };
    })
  );
  return catalog;
}

/** Bir reponun tüm release'leri (indirilebilir olanlar). */
async function listReleases(fullName) {
  const releases = await api(`/repos/${fullName}/releases?per_page=30`);
  return downloadableReleases(releases).map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
    exeAssets: exeAssetsOf(r).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
      downloads: a.download_count,
    })),
  }));
}

/** Reponun README metnini (markdown) çeker. */
async function getReadme(fullName) {
  const r = await api(`/repos/${fullName}/readme`);
  return Buffer.from(r.content, 'base64').toString('utf8');
}

module.exports = {
  api,
  listRepos,
  isExeAsset,
  exeAssetsOf,
  isDownloadableRelease,
  downloadableReleases,
  releaseIsNewer,
  logoUrl,
  buildCatalog,
  listReleases,
  getReadme,
};
