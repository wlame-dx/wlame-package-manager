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
  const repos = await api(`/users/${OWNER}/repos?per_page=100&sort=updated`);
  const usable = repos.filter((r) => !r.fork && !r.archived);

  const items = await Promise.all(
    usable.map(async (repo) => {
      let release = null;
      try {
        release = await api(`/repos/${repo.full_name}/releases/latest`);
      } catch (_) {
        /* sürüm yok */
      }
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

  all = items.sort((a, b) => Number(b.downloadable) - Number(a.downloadable) || b.stars - a.stars);
  $('#refresh-time').textContent = new Date().toLocaleString('tr-TR');
  $('#stat-repos').textContent = all.length;
  $('#stat-downloads').textContent = all.filter((i) => i.downloadable).length;
  $('#stat-wl').textContent = all.reduce((s, i) => s + i.stars, 0);
  render();
}

function render() {
  const q = query.trim().toLowerCase();
  const items = all.filter((i) => !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  grid.innerHTML = '';
  $('#grid-empty').classList.toggle('hidden', items.length > 0);

  for (const app of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <img class="card-logo" src="${app.logo}" alt="" referrerpolicy="no-referrer" loading="lazy" />
        <div>
          <div class="card-title">${esc(app.name)}</div>
          <div class="card-ver">${app.tag ? 'Sürüm ' + esc(app.tag) : 'Yakında'}</div>
        </div>
      </div>
      <div class="card-desc">${esc(app.description)}</div>
      <div class="card-meta">
        <span>★ ${app.stars}</span>
        ${app.publishedAt ? `<span>◷ ${new Date(app.publishedAt).toLocaleDateString('tr-TR')}</span>` : ''}
        ${app.downloadable ? '<span class="pill">HAZIR</span>' : '<span class="pill off">YAKINDA</span>'}
      </div>
      <div class="card-actions">
        <a class="btn" href="${app.htmlUrl}" target="_blank" rel="noopener">Detay</a>
        <button class="btn primary" data-dl ${app.downloadable ? '' : 'disabled'}>İndir</button>
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
