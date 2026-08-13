// Token\u8be6\u60c5\u4fa7\u8fb9\u62bd\u5c49（\u53c2\u7167 GeckoTerminal \u98ce\u683c · \u79fb\u52a8\u7aef\u5e95\u90e8\u62bd\u5c49）
import {createChart, ColorType, CrosshairMode, LineStyle} from '../vendor/lightweight-charts.standalone.production.mjs';
import {money,compact,percent,escapeHTML} from '../utils/format.js';

const _chainName={bsc:'BSC',eth:'Ethereum',base:'BASE',arbitrum:'Arbitrum',polygon:'POLYGON',solana:'Solana'};
const _explorer={bsc:'https://bscscan.com',eth:'https://etherscan.io',base:'https://basescan.org',arbitrum:'https://arbiscan.io',polygon:'https://polygonscan.com',solana:'https://solscan.io'};
const _state={open:false,project:null,chart:null,ro:null,escBound:false};

function _ensureRoot(){let r=document.getElementById('token-detail-panel-root');if(!r){r=document.createElement('div');r.id='token-detail-panel-root';document.body.appendChild(r)}return r}
function _esc(e){if(e.key==='Escape'&&_state.open)close()}
function _ensureEsc(){if(!_state.escBound){addEventListener('keydown',_esc);_state.escBound=true}}
function _fmtTime(t){if(!t)return'—';const d=new Date(t*1000);return`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}

async function _dsTokens(addr){try{const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+addr.toLowerCase(),{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)return{};const d=await r.json();const pairs=d.pairs||[];if(!pairs.length)return{};const best=pairs.slice().sort((a,b)=>Number((b.liquidity||{}).usd||0)-Number((a.liquidity||{}).usd||0))[0];return{best,pairs:pairs.slice(0,5)}}catch{return{}}}
async function _apiTokenSnapshot(chain,addr){try{const r=await fetch(`/api/monitor?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(addr)}`);if(!r.ok)return{};return r.json()}catch{return{}}}
async function _apiTrades(chain,token){const r=await fetch(`/api/token/trades?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`);if(!r.ok)return{trades:[]};return r.json()}
async function _apiKline(chain,token,tf,limit){const r=await fetch(`/api/kline?symbol=${encodeURIComponent(token)}&chain=${encodeURIComponent(chain)}&tf=${encodeURIComponent(tf)}&limit=${limit}`);if(!r.ok)return{candles:[]};return r.json().catch(()=>({candles:[]}))}

function _renderHeader(p,best){
  const liq=best?.liquidity?.usd??p.liquidity_usd;
  const vol=best?.volume?.h24??p.volume_24h;
  const mcap=best?.fdv??best?.marketCap??p.fdv;
  const pc=best?.priceChange?.h24??p.price_change_24h;
  const explorer=_explorer[p.chain]||'https://etherscan.io';
  const tokenUrl=(best?.url)||`https://dexscreener.com/${p.chain||'ethereum'}/${p.token}`;
  const chainName=_chainName[p.chain]||(p.chain||'').toUpperCase();
  const buys=p.buys_24h,sells=p.sells_24h;
  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:16px;border-bottom:1px solid rgba(128,128,128,.15);position:sticky;top:0;background:#0b0f16;z-index:1">
    <button data-close style="background:none;border:none;color:#7c8aa0;font-size:20px;cursor:pointer;padding:4px 10px;line-height:1">✕</button>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        ${p.logo?`<img src="${escapeHTML(p.logo)}" style="width:36px;height:36px;border-radius:50%;flex:none">`:`<span style="width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;background:rgba(128,128,128,.2);border-radius:50%;font-size:11px;flex:none">${escapeHTML((p.symbol||'?').slice(0,3))}</span>`}
        <div style="flex:1;min-width:0">
          <h2 style="margin:0;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(p.name||p.symbol||'?')} <small style="opacity:.55;font-weight:400">${escapeHTML(p.symbol||'')}</small></h2>
          <div style="display:flex;gap:8px;font-size:11px;opacity:.6;align-items:center;margin-top:3px;flex-wrap:wrap">
            <span class="ex-badge">${escapeHTML(chainName)}</span>
            ${best?.dexId?`<span>· ${escapeHTML(best.dexId)}</span>`:''}
            <span style="font-family:monospace">${escapeHTML((p.token||'').slice(0,6))}…${escapeHTML((p.token||'').slice(-4))}</span>
            <button data-copy="${escapeHTML(p.token||'')}" style="background:rgba(128,128,128,.15);border:1px solid rgba(128,128,128,.3);color:inherit;border-radius:4px;padding:1px 6px;font-size:10px;cursor:pointer">Copy</button>
          </div>
        </div>
        ${p.risk_score!=null?`<span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;flex:none;${p.risk_level==='danger'?'background:rgba(255,95,109,.18);color:#ff5f6d':p.risk_level==='high'?'background:rgba(255,159,67,.15);color:#ff9f43':p.risk_level==='watch'?'background:rgba(244,183,40,.15);color:#f4b728':'background:rgba(32,217,154,.14);color:#20d99a'}">${p.risk_score}</span>`:''}
      </div>
      <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap">
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">Price</div><b style="font-size:18px">${money(p.price_usd)}</b></div>
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">24H</div><b style="color:${Number(pc)>=0?'#20d99a':'#ff5f6d'}">${percent(pc)}</b></div>
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">Liquidity</div><b>${compact(liq)}</b></div>
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">VOL 24H</div><b>${compact(vol)}</b></div>
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">MCAP</div><b>${compact(mcap)}</b></div>
        <div><div style="font-size:10px;opacity:.5;text-transform:uppercase">TXNS</div><b>${buys!=null?`${buys}/${sells||0}`:'—'}</b></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;font-size:11px">
        <a href="${escapeHTML(tokenUrl)}" target="_blank" rel="noreferrer" style="color:#4f8cff;text-decoration:none;border:1px solid rgba(79,140,255,.4);padding:4px 10px;border-radius:12px">External Market ↗</a>
        <a href="${escapeHTML(explorer+(p.chain==='solana'?'':'/address/')+p.token)}" target="_blank" rel="noreferrer" style="color:#4f8cff;text-decoration:none;border:1px solid rgba(79,140,255,.4);padding:4px 10px;border-radius:12px">Block Explorer ↗</a>
      </div>
    </div>
  </div>`;
}

function _renderRisk(p){
  if(!p.risk_score&&!p.risk_tags)return'';
  return `<div style="padding:10px 16px;border-bottom:1px solid rgba(128,128,128,.1);font-size:12px">
    <div style="opacity:.5;margin-bottom:6px">AI Risk · ${p.risk_level==='danger'?'High':p.risk_level==='high'?'Medium':p.risk_level==='watch'?'Watch':'Normal'}</div>
    <div>${(p.risk_tags||[]).map(t=>`<span style="display:inline-block;padding:2px 8px;background:rgba(255,159,67,.1);color:#ff9f43;border-radius:4px;margin-right:4px;margin-bottom:4px">${escapeHTML(t)}</span>`).join('')||'<span style="opacity:.5">None</span>'}</div>
  </div>`;
}

function _renderPools(pairs){
  if(!pairs||!pairs.length)return'';
  return `<div style="padding:10px 16px;border-bottom:1px solid rgba(128,128,128,.1);font-size:12px">
    <div style="opacity:.5;margin-bottom:8px">Liquidity Pools · TOP ${pairs.length}</div>
    ${pairs.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="min-width:50px;opacity:.7">${escapeHTML(x.dexId||'')}</span><span style="flex:1;opacity:.6;font-size:11px;font-family:monospace">${escapeHTML((x.pairAddress||'').slice(0,8))}…${escapeHTML((x.pairAddress||'').slice(-4))}</span><span>$${compact(x.liquidity?.usd)}</span><span style="color:${Number(x.priceChange?.h24)>=0?'#20d99a':'#ff5f6d'};font-size:11px">${percent(x.priceChange?.h24)}</span></div>`).join('')}
  </div>`;
}

function _renderTrades(trades){
  if(!trades||!trades.length)return`<div style="padding:12px 16px;opacity:.5;font-size:12px">No trades</div>`;
  return `<div style="border-bottom:1px solid rgba(128,128,128,.1)">
    <div style="padding:8px 16px;opacity:.5;font-size:11px">Trade History · ${trades.length}  Trades</div>
    <div style="max-height:240px;overflow-y:auto">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="opacity:.5"><th align="left" style="padding:4px 16px;font-weight:normal">Time</th><th align="left" style="padding:4px;font-weight:normal">Side</th><th align="right" style="padding:4px;font-weight:normal">Price</th><th align="right" style="padding:4px 16px;font-weight:normal">Amount</th></tr></thead>
      <tbody>${trades.slice(0,12).map(t=>`<tr style="border-top:1px solid rgba(128,128,128,.05)"><td style="padding:4px 16px;opacity:.7">${_fmtTime(t.time)}</td><td style="padding:4px;color:${t.kind==='buy'?'#20d99a':'#ff5f6d'}">${t.kind==='buy'?'Buy':'Sell'}</td><td align="right" style="padding:4px">${money(t.price_usd)}</td><td align="right" style="padding:4px 16px;opacity:.7">${compact(t.amount_in||t.amount_out)}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function _renderKline(candles){
  return `<div style="padding:0">
    <div style="padding:8px 16px;opacity:.5;font-size:11px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;align-items:center"><span>Chart</span><span style="font-size:10px;opacity:.6">Scroll to zoom · Drag to pan · Crosshair</span></div>
    <div style="display:flex;gap:4px;padding:4px 12px" id="tdp-tfbar">
      ${['1m','5m','15m','1H','4h','1D','1W'].map(tf=>`<button data-tf="${tf}" class="seg-btn ${tf==='1H'?'active':''}">${tf}</button>`).join('')}
    </div>
    <div id="tdp-chart-wrap" style="position:relative;width:100%;height:280px"></div>
  </div>`;
}

function _buildKline(chartData){
  const cv=document.getElementById('tdp-chart-wrap');if(!cv)return;
  if(_state.chart){try{_state.chart.remove()}catch{} _state.chart=null}
  if(_state.ro){try{_state.ro.disconnect()}catch{} _state.ro=null}
  const candles=(chartData&&chartData.candles)||[];
  if(typeof createChart!=='function'){cv.innerHTML='<div style="padding:60px 20px;text-align:center;opacity:.5">Chart library unavailable</div>';return}
  const w=Math.max(280,cv.clientWidth||600),h=280;
  const chart=createChart(cv,{width:w,height:h,
    layout:{background:{type:ColorType.Solid,color:'#0b0f16'},textColor:'#7c8aa0',fontSize:10,fontFamily:'monospace'},
    grid:{vertLines:{color:'rgba(23,32,44,.5)'},horzLines:{color:'rgba(23,32,44,.5)'}},
    rightPriceScale:{borderColor:'rgba(28,38,54,1)'},timeScale:{borderColor:'rgba(28,38,54,1)',timeVisible:true,secondsVisible:false},
    crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'rgba(120,140,170,.5)',width:1,style:LineStyle.Dashed},horzLine:{color:'rgba(120,140,170,.5)',width:1,style:LineStyle.Dashed}},
    handleScroll:{mouseWheel:true,pressedMouseMove:true},handleScale:{axisPressedMouseMove:true,mouseWheel:true}});
  const cs=chart.addCandlestickSeries({upColor:'#20d99a',downColor:'#ff5f6d',borderUpColor:'#20d99a',borderDownColor:'#ff5f6d',wickUpColor:'#20d99a',wickDownColor:'#ff5f6d'});
  const vol=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol'});
  chart.priceScale('vol').applyOptions({scaleMargins:{top:0.78,bottom:0}});
  const rows=candles.filter(c=>c&&['open','high','low','close'].every(k=>Number.isFinite(Number(c[k]))));
  if(rows.length){
    cs.setData(rows.map(c=>({time:Math.floor(Number(c.time)),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)})));
    vol.setData(rows.map(c=>({time:Math.floor(Number(c.time)),value:Number(c.volume)||0,color:Number(c.close)>=Number(c.open)?'rgba(32,217,154,.5)':'rgba(255,95,109,.5)'})));
    try{cs.createPriceLine({price:Number(rows[rows.length-1].close),color:'rgba(104,116,136,.65)',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true})}catch{}
    chart.timeScale().fitContent();
  }else{
    cv.insertAdjacentHTML('beforeend','<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.4;pointer-events:none">No chart history is available for this pool.</div>');
  }
  _state.chart=chart;
  if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(()=>{const ww=Math.max(280,cv.clientWidth);if(ww!==chart.width())chart.applyOptions({width:ww})});ro.observe(cv);_state.ro=ro}
}

export async function openTokenPanel(p){
  const root=_ensureRoot();
  root.innerHTML=`<div data-mask style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;backdrop-filter:blur(2px)"></div>
    <div data-drawer style="position:fixed;top:0;right:0;bottom:0;width:100%;max-width:680px;background:#0b0f16;border-left:1px solid rgba(128,128,128,.2);z-index:9001;overflow-y:auto;box-shadow:-8px 0 24px rgba(0,0,0,.5);animation:slideIn .22s ease-out">
      <div data-loading style="padding:100px 20px;text-align:center;opacity:.6">Loading…</div>
    </div>
    <style>@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}</style>`;
  _ensureEsc();
  _state.open=true;_state.project=p;
  const mask=root.querySelector('[data-mask]'),drawer=root.querySelector('[data-drawer]');
  mask.addEventListener('click',close);
  try{
    const [ds,trades,kline]=await Promise.all([_dsTokens(p.token),_apiTrades(p.chain,p.token).catch(()=>({trades:[]})),_apiKline(p.chain,p.token,'1H',120).catch(()=>({candles:[]}))]);
    drawer.innerHTML=_renderHeader(p,ds.best)+_renderRisk(p)+_renderPools(ds.pairs)+_renderKline(kline.candles)+_renderTrades(trades.trades||trades);
    drawer.querySelector('[data-close]').addEventListener('click',close);
    drawer.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1500)}catch{}}));
    drawer.querySelectorAll('#tdp-tfbar [data-tf]').forEach(b=>b.addEventListener('click',async()=>{drawer.querySelectorAll('#tdp-tfbar [data-tf]').forEach(x=>x.classList.toggle('active',x===b));const tf=b.dataset.tf;const r=await _apiKline(p.chain,p.token,tf,120).catch(()=>({candles:[]}));_buildKline(r)}));
    _buildKline(kline);
  }catch(e){
    drawer.innerHTML=`<div style="padding:100px 20px;text-align:center"><div style="color:#ff5f6d;margin-bottom:8px">Load failed</div><div style="opacity:.5;font-size:11px">${escapeHTML(String(e&&e.message||e))}</div><button data-close style="margin-top:16px;padding:6px 14px;background:rgba(128,128,128,.2);border:1px solid rgba(128,128,128,.3);border-radius:6px;color:inherit;cursor:pointer">Close</button></div>`;
    drawer.querySelector('[data-close]').addEventListener('click',close);
  }
}

export function close(){
  if(_state.ro){try{_state.ro.disconnect()}catch{} _state.ro=null}
  if(_state.chart){try{_state.chart.remove()}catch{} _state.chart=null}
  const r=document.getElementById('token-detail-panel-root');if(r)r.innerHTML='';
  _state.open=false;_state.project=null;
}

export function isOpen(){return _state.open}
