// \u6298\u53e0\u5c55\u5f00\u5361\u7247\u7ec4\u4ef6（2026-08-07 \u65b0\u589e）：\u9ed8\u8ba4\u6536\u8d77，\u70b9\u51fb\u5c55\u5f00，\u5e73\u6ed1\u52a8\u753b
// \u52a8\u753b\u7528 CSS grid-template-rows: 0fr / 1fr \u6280\u5de7（None max-height \u4f30\u7b97\u95ee\u9898，None\u8df3\u52a8）
export function collapseCard({ title, summary, error, retryLabel, dataSources, extraNote }) {
  const retry = retryLabel ? `<button class="terminal-btn primary collapse-retry" type="button">${escapeHtml(retryLabel)}</button>` : '';
  const errBlock = error ? `<p class="collapse-error">${escapeHtml(error)}</p>` : '';
  const sources = Array.isArray(dataSources) && dataSources.length
    ? `<div class="collapse-sources">
        <h4>Asset Research Links</h4>
        <div class="sources-grid">${dataSources.map(s => `
          <a class="source-card" href="${escapeHtml(s.url || '#')}" target="_blank" rel="noreferrer">
            <span class="source-name">${escapeHtml(s.name)}</span>
            <span class="source-desc">${escapeHtml(s.desc || '')}</span>
            <span class="source-status ${escapeHtml(s.statusClass || 'loading')}">${escapeHtml(s.statusLabel || 'Checking')}</span>
          </a>`).join('')}</div>
      </div>` : '';
  const note = extraNote ? `<p class="collapse-note">${escapeHtml(extraNote)}</p>` : '';
  return `<div class="collapse-card">
    <div class="collapse-head" role="button" tabindex="0" aria-expanded="false">
      <span class="collapse-state" aria-hidden="true">▾</span>
      <div class="collapse-head-main">
        <strong class="collapse-title">${escapeHtml(title || 'Load failed')}</strong>
        ${summary ? `<span class="collapse-summary">${escapeHtml(summary)}</span>` : ''}
      </div>
      ${retry}
    </div>
    <div class="collapse-body"><div>
      <div class="collapse-content">
        ${errBlock}
        ${sources}
        ${note}
      </div>
    </div></div>
  </div>`;
}

// \u7ed1\u5b9a\u4ea4\u4e92：\u70b9\u51fb\u5934\u90e8\u5c55\u5f00/\u6536\u8d77 + RetryEvents\u5192\u6ce1
export function bindCollapse(root, opts = {}) {
  root.querySelectorAll('.collapse-card').forEach(card => {
    const head = card.querySelector('.collapse-head');
    if (!head) return;
    const toggle = (ev) => {
      // Retry\u6309\u94ae\u81ea\u8eab\u5904\u7406
      if (ev && ev.target && ev.target.closest && ev.target.closest('.collapse-retry')) return;
      const open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
    });
    const retryBtn = card.querySelector('.collapse-retry');
    if (retryBtn && opts.onRetry) {
      retryBtn.addEventListener('click', e => { e.stopPropagation(); opts.onRetry(); });
    }
  });
}

// \u6781\u7b80 HTML \u8f6c\u4e49（\u907f\u514d\u5f15\u5916\u90e8\u4f9d\u8d56；\u8db3\u591f\u8986\u76d6\u5c5e\u6027/\u6587\u672c\u573a\u666f）
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
