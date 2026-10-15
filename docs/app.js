/* WLAME Hub — landing sayfası mantığı.
   Koleksiyon tarayıcıda canlı çekilir; arayüz kullanıcıya yöneliktir. */
const OWNER = 'wlame-dx';
const API = 'https://api.github.com';

const $ = (s) => document.querySelector(s);
const grid = $('#grid');

let all = []; // tüm koleksiyon
let query = '';

const fmtBytes = (b) => {
  if (!Number.isFinite(b)) return '?';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function loadCatalog() {
  let repos;
  try {
    repos = await api(`/users/${OWNER}/repos?per_page=100&sort=updated`);
  } catch (e) {
    // Bağlantı sınırı / ağ hatası → son bilinen listeyi göster
    const cached = readCache();
    if (cached) {
      all = cached.items;
      $('#refresh-time').textContent = new Date(cached.at).toLocaleString('tr-TR') + ' (önbellek)';
      updateStats();
      render();
      note('Liste şu an yenilenemedi, son bilinen hâli gösteriliyor.');
      return;
    }
    throw e;
  }
  const usable = repos.filter((r) => !r.fork && !r.archived);

  const items = await Promise.all(
    usable.map(async (repo) => {
      let releases = [];
      try {
        releases = await api(`/repos/${repo.full_name}/releases?per_page=30`);
      } catch (_) {
        /* sürüm yok / limit */
      }
      // .exe içeren en yeni sürüm (yoksa en yeni sürüm)
      const withExe = releases.find((r) => (r.assets || []).some((a) => /\.exe$/i.test(a.name)));
      const release = withExe || releases[0] || null;
      const exes = (release?.assets || []).filter((a) => /\.exe$/i.test(a.name));
      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || 'Açıklama yakında.',
        stars: repo.stargazers_count,
        logo: `https://opengraph.githubassets.com/1/${repo.full_name}`,
        htmlUrl: repo.html_url,
        tag: release?.tag_name || null,
        publishedAt: release?.published_at || null,
        downloadable: exes.length > 0,
        assets: exes.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url, downloads: a.download_count })),
      };
    })
  );

  all = items
    .filter((i) => i.downloadable && Array.isArray(i.assets) && i.assets.length > 0)
    .sort((a, b) => b.stars - a.stars);
  $('#refresh-time').textContent = new Date().toLocaleString('tr-TR');
  writeCache(all);
  updateStats();
  render();
}

const CACHE_KEY = 'wlame-hub-catalog-v1';

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch (_) {}
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && Array.isArray(raw.items) && raw.items.length) return raw;
  } catch (_) {}
  return null;
}

function updateStats() {
  const fresh = all.filter(
    (i) => i.publishedAt && Date.now() - new Date(i.publishedAt).getTime() < 30 * 86400000
  ).length;
  $('#stat-repos').textContent = all.length;
  $('#stat-downloads').textContent = fresh;
  $('#stat-wl').textContent = all.reduce((s, i) => s + i.stars, 0);
}

function note(text) {
  const el = document.getElementById('catalog-note');
  if (el) {
    el.textContent = text;
    el.classList.remove('hidden');
  }
}

function render() {
  const q = query.trim().toLowerCase();
  const items = all.filter((i) => !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  grid.innerHTML = '';
  $('#grid-empty').classList.toggle('hidden', items.length > 0);
  $('#grid-empty').textContent =
    all.length === 0 ? 'Şimdilik yayınlanmış (sürümlü) uygulama yok, yakında eklenecek.' : 'Eşleşen uygulama yok.';

  for (const app of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <img class="card-logo" src="${app.logo}" alt="" referrerpolicy="no-referrer" loading="lazy"
             onerror="this.style.visibility='hidden'" />
        <div>
          <div class="card-title">${esc(app.name)}</div>
          <div class="card-ver">${app.tag ? 'Sürüm ' + esc(app.tag) : ''}</div>
        </div>
      </div>
      <div class="card-desc">${esc(app.description)}</div>
      <div class="card-meta">
        <span>★ ${app.stars}</span>
        ${app.publishedAt ? `<span>◷ ${new Date(app.publishedAt).toLocaleDateString('tr-TR')}</span>` : ''}
        ${app.assets.length > 1 ? `<span>${app.assets.length} dosya seçeneği</span>` : ''}
        <span class="pill">HAZIR</span>
      </div>
      <div class="card-actions">
        <button class="btn" data-dl>İndir</button>
      </div>`;

    const btn = card.querySelector('[data-dl]');
    btn.addEventListener('click', () => download(app));
    grid.appendChild(card);
  }
}

function download(app) {
  if (app.assets.length === 1) {
    window.location.href = app.assets[0].url; // doğrudan indir
    return;
  }
  // 2+ dosya → seçim
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>Hangi dosyayı indirsin?</h3>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <p class="muted">${esc(app.name)} — ${app.assets.length} seçenek var, istediğinizi seçin.</p>
      <div class="asset-options">
        ${app.assets
          .map(
            (a, i) => `
          <a class="asset-opt" href="${a.url}" data-i="${i}">
            <span class="ico">⚙</span>
            <div class="grow">
              <div class="fn">${esc(a.name)}</div>
              <div class="fm">${fmtBytes(a.size)} · ${a.downloads} indirme</div>
            </div>
            <span class="btn primary" style="flex:0 0 auto;">İndir</span>
          </a>`
          )
          .join('')}
      </div>
    </div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

/* olaylar */
$('#q').addEventListener('input', (e) => {
  query = e.target.value;
  render();
});
$('#refresh').addEventListener('click', () => {
  grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  loadCatalog().catch(() => $('#grid-empty').classList.remove('hidden'));
});

loadCatalog().catch(() => {
  grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Şu anda koleksiyon yüklenemedi, lütfen tekrar deneyin.</p>';
});
