// \u6e32\u67d3\u6027\u80fd\u5de5\u5177：\u6570\u636e\u5feb\u7167\u5bf9\u6bd4\u8df3\u8fc7\u91cd\u7ed8 + \u6eda\u52a8\u4f4d\u7f6e\u4fdd\u6301 + Enter\u9632\u6296
// \u7531 2026-08-07 \u6027\u80fd\u4f18\u5316\u5f15\u5165（\u5168\u7ad9 30s \u5168\u91cf innerHTML \u91cd\u7ed8 → NoneChange\u8df3\u8fc7/Change\u65f6\u4fdd\u6eda\u52a8\u91cd\u7ed8）

// \u5feb\u7167\u5bf9\u6bd4：\u6570\u636e\u5e8f\u5217\u5316\u540e\u76f8\u540c\u5219None\u9700\u91cd\u7ed8（\u8fd4\u56de true \u8868\u793a“\u6ca1\u6709Change，\u53ef\u8df3\u8fc7”）
export function unchanged(snap, data) {
  if (snap.current === null) return false; // \u9996\u5e27\u5fc5\u987b\u6e32\u67d3
  return snap.current === JSON.stringify(data);
}
export function snapshot(data) {
  return JSON.stringify(data);
}

// \u6eda\u52a8\u4fdd\u6301：\u5728 fn \u524d\u540e\u8bb0\u5f55\u5e76\u6062\u590d\u6240\u6709\u5339\u914d\u6eda\u52a8\u5bb9\u5668\u7684 scrollTop（\u652f\u6301\u591a\u8868\u683c Page\u9762）
export function withScroll(root, selector, fn) {
  const scs = Array.from(root.querySelectorAll(selector));
  const tops = scs.map(sc => sc.scrollTop);
  const result = fn();
  if (scs.length) {
    const after = Array.from(root.querySelectorAll(selector));
    after.forEach((el, i) => {
      const t = tops[i];
      if (t !== undefined && el.scrollTop !== t) el.scrollTop = t;
    });
  }
  return result;
}

// Enter\u9632\u6296：delay \u6beb\u79d2\u5185\u53ea\u6267\u884c\u6700\u540e\u4e00\u6b21
export function debounce(fn, delay = 200) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, delay);
  };
}

// \u5207 Page\u9aa8\u67b6\u5c4f（2026-08-07 \u5f15\u5165）： Page\u9762\u6570\u636e\u52a0\u8f7d\u671f\u95f4\u663e\u793a\u5360\u4f4d\u9aa8\u67b6，\u907f\u514d\u767d\u5c4f\u7b49\u5f85
const SKEL_WIDTHS = [62, 48, 74, 55, 68, 42, 58, 70, 50, 64];
export function skeleton({ cards = 4, panels = 1, rows = 5, cols = 5, chart = false } = {}) {
  const bar = (w, cls = '') => `<div class="skel-bar ${cls}" style="width:${w}%"></div>`;
  let html = '<div class="skel-wrap" aria-hidden="true">';
  if (cards) {
    html += `<div class="overview-grid skel-overview">${Array.from({ length: cards }, () =>
      `<div class="metric-card skel-card">${bar(38)}${bar(55, 'lg')}${bar(28, 'sm')}</div>`).join('')}</div>`;
  }
  if (chart) {
    html += `<section class="panel skel-panel"><div class="panel-head">${bar(18)}</div><div class="skel-chart"></div></section>`;
  }
  for (let p = 0; p < panels; p++) {
    html += `<section class="panel skel-panel"><div class="panel-head">${bar(20)}</div><div class="table-scroll"><table class="market-table"><thead><tr>${Array.from({ length: cols }, () => `<th>${bar(70, 'sm')}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: rows }, (_, r) => `<tr>${Array.from({ length: cols }, (_, c) => `<td>${bar(SKEL_WIDTHS[(r * 3 + c) % SKEL_WIDTHS.length])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  return html + '</div>';
}
