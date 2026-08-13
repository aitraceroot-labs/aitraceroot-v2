export const money = v => v==null?'—':Number(v).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number(v)<1?4:2,maximumFractionDigits:Number(v)<1?6:2});
export const compact = v => v==null?'—':'$'+Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(v));
export const percent = (v,d=2) => v==null?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(d)}%`;
export const number = v => v==null?'—':Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(v));
export const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const time = v => v?new Date(Number(v)*1000).toLocaleString('en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
// Note\u6e32\u67d3：\u542b "(x.com/xxx)" \u65f6\u628a X \u540d\u5b57\u6e32\u67d3\u4e3a\u53ef\u70b9\u51fbChain\u63a5（\u4fdd\u7559 X Chain\u63a5，\u89c4\u5219 2026-08-09）
export const noteHtml = note => {
  if(!note)return '—';
  const s = String(note);
  const m = s.match(/\(\s*x\.com\/([A-Za-z0-9_]{1,30})\s*\)\s*$/);
  if(m){
    const handle = m[1];
    const name = s.replace(/\(\s*x\.com\/[A-Za-z0-9_]{1,30}\s*\)\s*$/, '').trim();
    return `<a href="https://x.com/${escapeHTML(handle)}" target="_blank" rel="noreferrer" style="color:#8ab6ff;text-decoration:none;border-bottom:1px dashed rgba(138,182,255,.45)" title="Open X: @${escapeHTML(handle)}">${escapeHTML(name || handle)} ↗</a>`;
  }
  return escapeHTML(s);
};
