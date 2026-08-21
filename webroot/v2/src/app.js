import {matchRoute} from './router.js';
import {renderLayout} from '../layouts/terminal-layout.js';
import {onChangeLang, registerZhObserver, applyZh} from '../i18n.js';
import {renderDashboard} from '../pages/dashboard/page.js';
import {renderPlaceholder} from '../pages/placeholder.js';
import {renderRadar} from '../pages/radar/page.js';
import {renderMarkets} from '../pages/markets/page.js';
import {renderFutures} from '../pages/futures/page.js';
import {renderToken} from '../pages/token/page.js';
import {renderAlpha} from '../pages/alpha/page.js';
import {renderSmartWallet} from '../pages/wallet/page.js';
import {renderRisk} from '../pages/risk/page.js';
import {renderFollow} from '../pages/follow/page.js';
import {renderSmartMoney} from '../pages/smartmoney/page.js';
import {renderUser} from '../pages/user/page.js';
import {store} from '../store/app-store.js';
import {escapeHTML} from '../utils/format.js';
import {errorMessage} from '../utils/safe.js';

let cleanup = null;
let renderGeneration = 0;

function releaseCleanup(fn=cleanup) {
  if (typeof fn === 'function') { try { fn(); } catch (error) { console.error('Page cleanup failed', error); } }
  if (fn === cleanup) cleanup=null;
}

function showErrorBoundary(error) {
  const message=escapeHTML(errorMessage(error));
  const target=document.querySelector('#workspace')||document.querySelector('#app');
  if(!target) return;
  target.innerHTML=`<section class="system-error" role="alert"><div class="system-error-code">SYSTEM EXCEPTION</div><h1>System Error</h1><p>${message}</p><button class="terminal-btn primary" id="reloadApplication">Reload</button></section>`;
  target.querySelector('#reloadApplication')?.addEventListener('click',()=>location.reload());
}

async function render() {
  const generation=++renderGeneration;
  releaseCleanup();
  try {
    const route = matchRoute();
    store.set({route:location.pathname});
    renderLayout(route.key);
    const root=document.querySelector('#workspace');
    if(!root) throw new Error('Failed to initialize the page workspace');
    const pages={dashboard:renderDashboard,markets:renderMarkets,futures:renderFutures,token:renderToken,alpha:renderAlpha,wallet:renderSmartWallet,risk:renderRisk,follow:renderFollow,smartmoney:renderSmartMoney,user:renderUser,radar:renderRadar};
    const result = pages[route.key] ? await pages[route.key](root,route) : renderPlaceholder(root,route.key);
    if(generation!==renderGeneration){releaseCleanup(result);return}
    if (typeof result === 'function') cleanup=result;
    applyZh(document);
  } catch (error) {
    console.error('Page render failed', error);
    if(generation===renderGeneration) showErrorBoundary(error);
  }
}
addEventListener('popstate',()=>{void render()});
addEventListener('error',event=>{
  console.error('Unhandled window error',event.error||event.message);
  showErrorBoundary(event.error||new Error(event.message||'Unknown script error'));
});
addEventListener('unhandledrejection',event=>{
  event.preventDefault();
  const reason=event.reason;
  console.error('Unhandled promise rejection',reason);
  const message=escapeHTML(errorMessage(reason)||'Action failed. Please try again.');
  let toast=document.querySelector('#op-toast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='op-toast';
    toast.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--color-background-secondary,#2a2a2e);color:var(--color-text-primary,#eee);border:1px solid var(--color-border-secondary,rgba(255,255,255,.3));border-radius:10px;padding:10px 18px;font-size:13px;max-width:80vw;box-shadow:0 4px 16px rgba(0,0,0,.35)';
    document.body.appendChild(toast);
  }
  toast.textContent=message;
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>{toast.remove()},4000);
});
void render();
registerZhObserver();
onChangeLang(()=>{ void render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/v2/sw.js', {scope:'/v2/'}).catch(()=>{});
