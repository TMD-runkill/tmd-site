// 讀取 /api/latest，把每個產品卡的版號、更新說明、下載列填進去。
(function () {
  const cards = document.querySelectorAll('.product[data-product]');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // Release 說明是 Markdown，這裡只處理最常見的「每行一條」清單，其餘原樣顯示。
  function notesToHtml(notes) {
    const lines = String(notes || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
    if (!lines.length) return '<li>無更新說明</li>';
    return lines.map((l) => '<li>' + esc(l) + '</li>').join('');
  }

  const FILE_META = {
    zip: { icon: 'fa-file-zipper', title: '完整包', desc: '解壓縮後執行主程式' },
  };

  function fileRow(f) {
    const m = FILE_META[f.kind] || { icon: 'fa-file', title: f.kind, desc: '' };
    return (
      '<div class="dl-item">' +
        '<div class="dl-info"><i class="fa-solid ' + m.icon + ' dl-icon"></i>' +
          '<div><h4>' + esc(m.title) + '</h4><p>' + esc(f.name) + (f.size ? ' · ' + formatSize(f.size) : '') + '</p></div>' +
        '</div>' +
        '<a class="btn btn-primary" href="' + esc(f.url) + '"><i class="fa-solid fa-download"></i> 下載</a>' +
      '</div>'
    );
  }

  function backupRow(url) {
    if (!url) return '';
    return (
      '<div class="dl-item dl-backup">' +
        '<div class="dl-info"><i class="fa-solid fa-life-ring dl-icon"></i>' +
          '<div><h4>備援下載</h4><p>主要下載無法使用時請改用此處</p></div>' +
        '</div>' +
        '<a class="btn btn-ghost" href="' + esc(url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 前往</a>' +
      '</div>'
    );
  }

  function render(card, data) {
    const badge = card.querySelector('[data-role="badge"]');
    const body = card.querySelector('[data-role="body"]');

    if (!data || data.status === 'error') {
      badge.className = 'badge badge-error';
      badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 暫時無法取得';
      body.innerHTML =
        '<p class="product-msg">暫時無法取得版本資訊，請稍後再試。</p>' +
        '<div class="dl-list">' + backupRow(data && data.backup_url) + '</div>';
      return;
    }

    if (data.status === 'building') {
      badge.className = 'badge badge-building';
      badge.innerHTML = '<i class="fa-solid fa-wrench"></i> 建置中';
      body.innerHTML = '<p class="product-msg">此工具目前正在研發測試中，完成後將於此處開放下載，敬請期待！</p>';
      return;
    }

    badge.className = 'badge badge-active';
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> v' + esc(data.version);

    const files = data.files || [];
    body.innerHTML =
      '<div class="changelog">' +
        '<div class="changelog-title"><i class="fa-solid fa-clock-rotate-left"></i> v' + esc(data.version) + ' 更新說明' +
          '<span class="changelog-date">' + esc(formatDate(data.published_at)) + '</span></div>' +
        '<ul>' + notesToHtml(data.notes) + '</ul>' +
      '</div>' +
      '<div class="dl-list">' +
        (files.length ? files.map(fileRow).join('') : '<p class="product-msg">最新版尚未附上檔案，請稍後再試。</p>') +
        backupRow(data.backup_url) +
      '</div>';
  }

  fetch('/api/latest', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((list) => {
      const byKey = {};
      list.forEach((p) => { byKey[p.product] = p; });
      cards.forEach((card) => render(card, byKey[card.dataset.product]));
    })
    .catch(() => cards.forEach((card) => render(card, null)));
})();

// 入群規範彈窗
function openModal() { document.getElementById('rulesModal').style.display = 'flex'; }
function closeModal() { document.getElementById('rulesModal').style.display = 'none'; }
function toggleJoinBtn() {
  document.getElementById('joinBtn').classList.toggle('active', document.getElementById('agreeCheck').checked);
}
window.addEventListener('click', (e) => { if (e.target === document.getElementById('rulesModal')) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
