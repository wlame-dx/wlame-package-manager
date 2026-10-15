/* WLAME Hub — renderer mantığı */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* Yayında olan (release + .exe içeren) uygulamalar dışarıdan gizlenir. */
function activeApps(list) {
  return (list || []).filter((c) => c && c.downloadable && Array.isArray(c.exeAssets) && c.exeAssets.length > 0);
}

const state = {
  catalog: [],
  installed: [],
  settings: null,
  currentView: 'store',
  search: '',
  // seçim modalı için
  pending: null, // { fullName, name, tag, logo, description, assets: [...] }
};

/* ---------- yardımcılar ---------- */
function fmtBytes(b) {
  if (!Number.isFinite(b)) return '?';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function toast(title, body = '', kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="t-title"></div><div class="t-body"></div>`;
  el.querySelector('.t-title').textContent = title;
  el.querySelector('.t-body').textContent = body;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 450);
  }, 5200);
}

function setStatus(text) {
  $('#status-text').textContent = text;
}

/* ---------- görünümler ---------- */
function switchView(view) {
  state.currentView = view;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#view-store').classList.toggle('hidden', view !== 'store');
  $('#view-installed').classList.toggle('hidden', view !== 'installed');
  $('#view-settings').classList.toggle('hidden', view !== 'settings');
  if (view === 'installed') renderInstalled();
  if (view === 'settings') renderSettings();
}

/* ---------- mağaza ---------- */
function renderCatalog() {
  const grid = $('#catalog-grid');
  const q = state.search.trim().toLowerCase();
  const items = state.catalog.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  );

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      ${state.catalog.length === 0
        ? 'Şimdilik yayınlanmış (sürümlü) uygulama yok.<br>Yeni uygulamalar eklendikçe burada belirecek.'
        : 'Eşleşen uygulama yok.'}
    </div>`;
    return;
  }

  grid.innerHTML = '';
  for (const app of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const pill = `<span class="pill">HAZIR</span>`;

    card.innerHTML = `
      <div class="card-head">
        <img class="card-logo" src="${app.logo}" alt="" referrerpolicy="no-referrer"
             onerror="this.style.visibility='hidden'" />
        <div>
          <div class="card-title">${escapeHtml(app.name)}</div>
          <div class="card-ver">${app.latestTag ? 'Sürüm ' + escapeHtml(app.latestTag) : ''}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(app.description || 'Açıklama yakında.')}</div>
      <div class="card-meta">
        <span>★ ${app.stars}</span>
        ${app.publishedAt ? `<span>◷ ${new Date(app.publishedAt).toLocaleDateString('tr-TR')}</span>` : ''}
        ${app.exeAssets.length > 1 ? `<span>${app.exeAssets.length} dosya seçeneği</span>` : ''}
        ${pill}
      </div>
      <div class="card-actions">
        <button class="btn ghost" data-act="readme">Bilgi</button>
        <button class="btn primary" data-act="download">İndir</button>
      </div>`;

    card.querySelector('[data-act="download"]').addEventListener('click', () => openDownload(app));
    card.querySelector('[data-act="readme"]').addEventListener('click', () => openReadme(app));
    card.addEventListener('dblclick', () => window.hub.openExternal(app.htmlUrl));
    grid.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- indirme akışı (çoklu .exe → seçim) ---------- */
async function openDownload(app, tagOverride) {
  setStatus(`${app.name} sürüm listesi çekiliyor...`);
  let releases;
  try {
    releases = await window.hub.listReleases(app.fullName);
  } catch (e) {
    toast('Sürüm listesi alınamadı', e.message, 'err');
    setStatus('Hazır.');
    return;
  }
  if (!releases.length) {
    toast('İndirilebilir sürüm yok', `${app.name} reposunda .exe içeren release bulunamadı.`, 'err');
    setStatus('Hazır.');
    return;
  }

  const release = tagOverride ? releases.find((r) => r.tag === tagOverride) || releases[0] : releases[0];

  // Tek .exe ise hiç sormadan indir
  if (release.exeAssets.length === 1) {
    startDownload(app, release, release.exeAssets[0]);
    return;
  }

  // 2+ .exe → seçim modalı
  state.pending = { app, releases, release };
  $('#modal-title').textContent = 'Hangi dosyayı indirsin?';
  $('#modal-sub').textContent = `${app.name} — ${release.name} (${release.tag}) paketinde ${release.exeAssets.length} farklı .exe var.`;

  const sel = $('#release-select');
  sel.innerHTML = releases
    .map((r) => `<option value="${escapeHtml(r.tag)}" ${r.tag === release.tag ? 'selected' : ''}>${escapeHtml(r.name)} — ${escapeHtml(r.tag)}</option>`)
    .join('');

  renderAssetOptions(release.exeAssets);
  $('#modal-assets').classList.remove('hidden');
  setStatus('Hazır.');
}

function renderAssetOptions(assets) {
  const box = $('#asset-options');
  box.innerHTML = '';
  assets.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'asset-opt';
    el.innerHTML = `
      <span class="ico">⚙</span>
      <div class="grow">
        <div class="fn">${escapeHtml(a.name)}</div>
        <div class="fm">${fmtBytes(a.size)} · ${a.downloads} indirme</div>
      </div>
      <span class="btn primary" style="flex:0 0 auto; pointer-events:none;">İndir</span>`;
    el.addEventListener('click', () => {
      box.querySelectorAll('.asset-opt').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      const { app, release } = state.pending;
      startDownload(app, release, a);
      $('#modal-assets').classList.add('hidden');
    });
    box.appendChild(el);
  });
}

function startDownload(app, release, asset) {
  window.hub
    .startDownload({
      fullName: app.fullName,
      name: app.name,
      tag: release.tag,
      assetUrl: asset.url,
      assetName: asset.name,
      logo: app.logo,
      description: app.description,
    })
    .then(({ id }) => {
      state.activeDownloadId = id;
      setStatus(`${asset.name} indiriliyor...`);
      toast('İndirme başladı', `${app.name} — ${asset.name}`);
    })
    .catch((e) => toast('İndirme hatası', e.message, 'err'));
}

/* ---------- README ---------- */
async function openReadme(app) {
  $('#readme-title').textContent = `${app.name} — README`;
  $('#readme-body').textContent = 'Yükleniyor...';
  $('#modal-readme').classList.remove('hidden');
  try {
    const md = await window.hub.getReadme(app.fullName);
    $('#readme-body').textContent = md;
  } catch (e) {
    $('#readme-body').textContent = `README bulunamadı: ${e.message}`;
  }
}

/* ---------- indirilenler ---------- */
async function renderInstalled() {
  const box = $('#installed-list');
  state.installed = await window.hub.listInstalled();
  updateInstalledBadge();

  if (state.installed.length === 0) {
    box.innerHTML = `<div class="empty">Henüz bir şey indirilmedi.<br>Mağazadan bir uygulama indirdiğinde burada listelenir.</div>`;
    return;
  }
  box.innerHTML = '';
  for (const it of state.installed) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
      <img src="${it.logo || ''}" alt="" referrerpolicy="no-referrer" />
      <div class="grow">
        <div class="name">${escapeHtml(it.name || it.fullName)}</div>
        <div class="muted">${escapeHtml(it.assetName || '')} · ${escapeHtml(it.tag || '')} · ${new Date(it.installedAt).toLocaleString('tr-TR')}</div>
      </div>
      <button class="btn primary" data-act="run">Çalıştır</button>
      <button class="btn ghost" data-act="show">Klasörde göster</button>
      <button class="btn ghost danger" data-act="remove">Kaldır</button>`;
    row.querySelector('[data-act="run"]').addEventListener('click', () => window.hub.run(it.filePath));
    row.querySelector('[data-act="show"]').addEventListener('click', () => window.hub.showItem(it.filePath));
    row.querySelector('[data-act="remove"]').addEventListener('click', async () => {
      state.installed = await window.hub.removeInstalled(it.fullName);
      renderInstalled();
    });
    box.appendChild(row);
  }
}

function updateInstalledBadge() {
  const b = $('#installed-badge');
  b.textContent = state.installed.length;
  b.classList.toggle('hidden', state.installed.length === 0);
}

/* ---------- ayarlar ---------- */
async function renderSettings() {
  state.settings = await window.hub.getSettings();
  $('#set-autostart').checked = !!state.settings.autostart;
  $('#set-autodownload').checked = !!state.settings.autoDownloadUpdates;
  $('#set-autorun').checked = state.settings.autoRun !== false;
  $('#set-downloaddir').textContent = state.settings.downloadDir;
  $('#set-variants').textContent = `${state.settings.owner} koleksiyonu · ${state.catalog.length} uygulama kayıtlı.`;
  $('#set-token').value = state.settings.token || '';
}

/* ---------- olaylar ---------- */
function bindEvents() {
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

  $('#search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderCatalog();
  });

  $('#btn-refresh').addEventListener('click', async () => {
    setStatus('Güncelleniyor...');
    $('#btn-refresh').disabled = true;
    try {
      const res = await window.hub.refreshCatalog();
      state.catalog = activeApps(res.apps || []);
      renderCatalog();
      setStatus(res.stale ? 'Önbellekten gösteriliyor.' : `Güncellendi (${state.catalog.length} uygulama).`);
      if (res.stale) toast('Bağlantı sınırı', 'Son bilinen liste gösteriliyor.', 'err');
    } catch (e) {
      toast('Bağlantı hatası', e.message, 'err');
      setStatus('Hazır.');
    } finally {
      $('#btn-refresh').disabled = false;
    }
  });

  $('#btn-updates').addEventListener('click', async () => {
    setStatus('Güncelleme kontrolü yapılıyor...');
    const r = await window.hub.checkUpdates();
    const ok = Array.isArray(r) ? r.filter((x) => x.newTag).length : 0;
    toast('Kontrol tamam', ok ? `${ok} güncelleme bulundu/indirildi.` : 'Tüm uygulamalar güncel.', ok ? '' : 'ok');
    setStatus('Hazır.');
  });

  $('#btn-settings').addEventListener('click', () => switchView('settings'));
  $('#win-min').addEventListener('click', () => window.hub.minimize());
  $('#win-close').addEventListener('click', () => window.hub.close());

  $('#modal-close').addEventListener('click', () => $('#modal-assets').classList.add('hidden'));
  $('#modal-assets').addEventListener('click', (e) => {
    if (e.target === $('#modal-assets')) $('#modal-assets').classList.add('hidden');
  });
  $('#release-select').addEventListener('change', (e) => {
    const { app } = state.pending;
    openDownload(app, e.target.value);
  });

  $('#readme-close').addEventListener('click', () => $('#modal-readme').classList.add('hidden'));
  $('#modal-readme').addEventListener('click', (e) => {
    if (e.target === $('#modal-readme')) $('#modal-readme').classList.add('hidden');
  });

  $('#set-autostart').addEventListener('change', async (e) => {
    await window.hub.setSettings({ autostart: e.target.checked });
    toast('Ayar kaydedildi', e.target.checked ? 'Açılışta otomatik başlatılacak.' : 'Otomatik başlatma kapatıldı.');
  });
  $('#set-autodownload').addEventListener('change', async (e) => {
    await window.hub.setSettings({ autoDownloadUpdates: e.target.checked });
    toast('Ayar kaydedildi', e.target.checked ? 'Güncellemeler otomatik indirilecek.' : 'Otomatik indirme kapatıldı.');
  });
  $('#set-autorun').addEventListener('change', async (e) => {
    await window.hub.setSettings({ autoRun: e.target.checked });
    toast('Ayar kaydedildi', e.target.checked ? 'İndirme bitince uygulama otomatik açılacak.' : 'Otomatik çalıştırma kapatıldı.');
  });
  $('#set-token').addEventListener('change', async (e) => {
    await window.hub.setSettings({ token: e.target.value.trim() });
    toast('Kaydedildi', 'Erişim anahtarı güncellendi.');
  });
  $('#btn-check-now').addEventListener('click', async () => {
    setStatus('Güncelleme kontrolü yapılıyor...');
    await window.hub.checkUpdates();
    setStatus('Hazır.');
    toast('Kontrol bitti', 'Sonuç bildirim olarak gönderildi.');
  });

  // indirme ilerlemesi / tamam / hata
  window.hub.onDownloadProgress((p) => {
    if (p.id !== state.activeDownloadId) return;
    const strip = $('#download-strip');
    strip.classList.remove('hidden');
    strip.innerHTML = `⬇ ${escapeHtml(p.assetName)} — <b>%${p.percent}</b> (${p.human})`;
    setStatus(`İndiriliyor: %${p.percent}`);
  });
  window.hub.onDownloadDone((p) => {
    if (p.id !== state.activeDownloadId) return;
    $('#download-strip').classList.add('hidden');
    toast(
      'İndirme tamamlandı',
      p.launched ? 'Uygulama başlatıldı.' : p.file,
      'ok'
    );
    setStatus('Hazır.');
    window.hub.listInstalled().then((l) => {
      state.installed = l;
      updateInstalledBadge();
      if (state.currentView === 'installed') renderInstalled();
    });
  });
  window.hub.onDownloadError((p) => {
    if (p.id !== state.activeDownloadId) return;
    $('#download-strip').classList.add('hidden');
    toast('İndirme hatası', p.error, 'err');
    setStatus('Hazır.');
  });

  window.hub.onUpdateNotification((n) => {
    toast(n.title, n.body, n.title.includes('hatası') || n.title.includes('ilemedi') ? 'err' : 'ok');
  });
}

/* ---------- başlangıç ---------- */
async function init() {
  bindEvents();
  try {
    const info = await window.hub.appInfo();
    $('#owner-name').textContent = info.owner;
    $('#owner-avatar').src = `https://avatars.githubusercontent.com/${info.owner}`;
  } catch (_) {}

  try {
    state.installed = await window.hub.listInstalled();
    updateInstalledBadge();
  } catch (_) {}

  setStatus('Uygulamalar yükleniyor...');
  try {
    const res = await window.hub.listCatalog();
    state.catalog = activeApps(res.apps || []);
    renderCatalog();
    if (res.stale) {
      toast(
        'Çevrimdışı liste',
        res.rateLimited
          ? 'Şu an bağlantı sınırına takıldık; son bilinen liste gösteriliyor. Birazdan tekrar dene.'
          : 'Sunucuya ulaşılamadı; son bilinen liste gösteriliyor.',
        'err'
      );
      setStatus('Önbellekten gösteriliyor.');
    } else {
      setStatus(`${state.catalog.length} uygulama yüklendi.`);
    }
  } catch (e) {
    $('#catalog-grid').innerHTML = `<div class="empty" style="grid-column:1/-1">Bağlantı kurulamadı, lütfen tekrar dene: ${escapeHtml(e.message)}</div>`;
    setStatus('Hata.');
  }
}

init();
