import {api} from '../../services/api.js';
import {escapeHTML,time} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, skeleton} from '../../utils/render.js';

const exchanges=['ALL','BWEnews','BWE RSS','Binance','OKX','Coinbase','KuCoin','Gate','MEXC','Bitget','Bybit','HTX','Upbit','Bithumb'];

export async function renderAlpha(root){
  const snap={current:null};
  let data={},active='ALL',timer;
  root.innerHTML=skeleton({cards:4,panels:1,rows:5,cols:6});
  const paint=()=>{
    if(!isMounted(root))return;
    const events=asArray(data.events).filter(e=>active==='ALL'||e.exchange===active);
    const candidates=asArray(data.candidates),watchlist=asArray(data.watchlist);
    const html=`<div class="page-head"><div><h1>Alpha Radar</h1><p>GLOBAL EXCHANGE LISTING INTELLIGENCE</p></div><div class="page-actions"><button class="seg-btn active">${data.sources_active??0}/${data.sources_target??0} ONLINE</button></div></div><div class="overview-grid"><article class="metric-card"><div class="metric-label">SOURCES</div><div class="metric-value up">${data.sources_active??0} / ${data.sources_target??0}</div><div class="metric-sub">Official feeds connected</div></article><article class="metric-card"><div class="metric-label">EVENTS</div><div class="metric-value">${asArray(data.events).length}</div><div class="metric-sub">Normalized events</div></article><article class="metric-card"><div class="metric-label">ALPHA CANDIDATES</div><div class="metric-value warn">${candidates.length}</div><div class="metric-sub">Strict rule matched</div></article><article class="metric-card"><div class="metric-label">WATCHLIST</div><div class="metric-value">${watchlist.length}</div><div class="metric-sub">Independent tracking</div></article></div><div class="toolbar alpha-filter">${exchanges.map(x=>`<button class="exchange-pill ${x===active?'active':''}" data-ex="${x}">${x}</button>`).join('')}</div><section class="panel alpha-table"><div class="panel-head"><h2>LISTING EVENT STREAM</h2><span>${events.length} EVENTS</span></div><table class="market-table"><thead><tr><th>TOKEN</th><th>EXCHANGE</th><th>EVENT</th><th>PATH</th><th>TIME</th><th>SCORE</th></tr></thead><tbody>${events.map(e=>`<tr><td><div class="asset"><span class="coin-icon">${escapeHTML((e?.symbol||'?').slice(0,3))}</span><b>${escapeHTML(e?.symbol||'—')}</b></div></td><td>${escapeHTML(e?.exchange)}</td><td>${escapeHTML(e?.title)}</td><td><div class="path-badges"><i>BINANCE</i><i>→</i><i>${escapeHTML(e?.exchange)}</i></div></td><td>${time(e?.published_at)}</td><td><span class="score-pill">${e?.score||50}</span></td></tr>`).join('')}</tbody></table></section>`
    if (unchanged(snap, html)) return;
    snap.current = snapshot(html);
    withScroll(root, '.table-scroll', () => { root.innerHTML = html; });
    root.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{active=b.dataset.ex;paint()});
  };
  try{
    data=asObject(await api.alpha());paint();
    timer=setInterval(async()=>{try{data=asObject(await api.alpha());paint()}catch{}},60000);
    renderAIRail();
  }catch(e){
    if(isMounted(root))root.innerHTML=`<div class="empty-page"><b>Alpha Radar Unavailable</b><p>${escapeHTML(e?.message)}</p></div>`;
    renderAIRail();
  }
  return()=>clearInterval(timer);
}
