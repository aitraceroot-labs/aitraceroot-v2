const numericPattern = /[-+]?[$¥€]?\d[\d,.]*(?:%|[KMBT])?/i;
let observer;

function startupMarkup() {
  return `<div class="terminal-startup" role="status" aria-label="AITRACEROOT terminal initialization"><div class="startup-grid" aria-hidden="true"></div><div class="startup-core"><div class="startup-logo"><img src="/v2/favicon.svg" alt=""><i></i><i></i><i></i></div><div class="startup-wordmark">AITRACEROOT <span>V2</span></div><div class="startup-subtitle">AI ON-CHAIN INTELLIGENCE TERMINAL</div><div class="startup-sequence"><span>Initializing AI Engine...</span><span>Connecting Blockchain Data...</span><span>Loading Market Intelligence...</span><span>Activating Risk Engine...</span></div><div class="startup-networks"><b>ETHEREUM</b><b>SOLANA</b><b>BASE</b><b>BINANCE</b><b>HYPERLIQUID</b></div><div class="startup-progress"><i></i></div></div></div>`;
}

export function runTerminalStartup() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem('atr-started')) return Promise.resolve();
  sessionStorage.setItem('atr-started', '1');
  document.body.insertAdjacentHTML('beforeend', startupMarkup());
  const el=document.querySelector('.terminal-startup');
  return new Promise(resolve=>setTimeout(()=>{el?.classList.add('startup-exit');setTimeout(()=>{el?.remove();resolve()},520)},3200));
}

export function beginPageTransition(root) { root?.classList.remove('page-enter');requestAnimationFrame(()=>requestAnimationFrame(()=>root?.classList.add('page-enter'))); }

function pulseChanged(el) { el.classList.remove('data-tick');void el.offsetWidth;el.classList.add('data-tick');clearTimeout(el._tickTimer);el._tickTimer=setTimeout(()=>el.classList.remove('data-tick'),650); }
function enhanceNode(node) { if (!(node instanceof Element)) return;const nodes=node.matches('td,.metric-value,.quote-stat b,.cg-stat b')?[node]:node.querySelectorAll('td,.metric-value,.quote-stat b,.cg-stat b');nodes.forEach(el=>{if(numericPattern.test(el.textContent||''))pulseChanged(el)}); }

export function installTerminalVisuals() {
  document.body.classList.add('terminal-visual-system');if(observer)return;
  observer=new MutationObserver(records=>records.forEach(record=>{if(record.type==='characterData')enhanceNode(record.target.parentElement);record.addedNodes.forEach(enhanceNode)}));
  observer.observe(document.querySelector('#app'),{subtree:true,childList:true,characterData:true});
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('visuals-paused',document.hidden));
}
