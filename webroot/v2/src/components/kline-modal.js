/* ============================================================
   AITRACEROOT V2 · K \u7ebf\u5f39\u7a97Total \u4eab\u7ec4\u4ef6（2026-08-09）
   \u5e02\u573a\u603b\u89c8(dashboard) / Markets(markets) Total \u7528：
   - \u70b9\u51fb\u4efb\u610fToken → \u5f39\u7a97\u5c55\u793a K \u7ebf（\u8721\u70db + Volume + MA7/25/60 + \u5341\u5b57\u7ebf OHLCV）
   - \u5468\u671f\u5207\u6362：1\u5206 / 15\u5206 / 1\u65f6 / 1\u65e5 / 1\u5468
   - Data SourceChain：On-ChainContract → GMGN On-Chain K \u7ebf → \u540e\u7aef /api/kline(GT DEX  Pools) → \u7a7a\u6001(DexScreener Chain\u63a5)
                CEX \u5e01 → \u540e\u7aef /api/kline(symbol, Binance)
   - Status UI：Loading / API Error / Network Error / No data（\u5747\u53efRetry）
   ============================================================ */
import {api} from '../services/api.js';
import {money,percent,escapeHTML} from '../utils/format.js';
import {asArray} from '../utils/safe.js';
import {drawTradingChart,disposeTradingChart} from '../charts/terminal-chart.js';

const KLINE_TFS=[{k:'1m',label:'1m'},{k:'15m',label:'15m'},{k:'1h',label:'1H'},{k:'1D',label:'1D'},{k:'1W',label:'1W'}];
const GMGN_RES={'1m':'1m','15m':'15m','1h':'1h','1D':'1d','1W':'1w'};
const DEX_CHAINS=['sol','bsc','base','eth','arbitrum','polygon','solana'];
const normChain=c=>String(c||'').toLowerCase().trim();
const isContractAddr=t=>!!t&&(t.startsWith('0x')||t.length===44);
const isDexCoin=c=>DEX_CHAINS.includes(normChain(c&&c.chain));
const errKind=e=>{
  if(e&&(e.name==='AbortError'||e instanceof TypeError||/network|fetch|\u8d85\u65f6/i.test(String(e&&e.message||''))))return'network';
  return'error';
};

let klineCtx=null,klineCur={},klineTf='1h';

const KLINE_CSS=`.kline-mask{position:fixed;inset:0;z-index:9999;background:rgba(4,10,18,.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;animation:klineFade .18s ease}
@keyframes klineFade{from{opacity:0}to{opacity:1}}
body.kline-lock{overflow:hidden}
.kline-modal{width:min(940px,100%);height:min(78vh,780px);min-height:420px;background:linear-gradient(160deg,rgba(18,24,38,.99),rgba(10,15,24,.99));border:1px solid rgba(8,231,247,.25);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)}
.kline-head{display:flex;align-items:center;gap:14px;padding:13px 16px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}
.kline-asset{display:flex;align-items:center;gap:11px;min-width:0;flex:1 1 240px}
.kline-asset .mkt-logo{flex:0 0 38px;width:38px;height:38px;font-size:12px;border-radius:11px;background:var(--surface-3,#1a2233);display:grid;place-items:center;color:var(--brand,#08e7f7);font:800 13px sans-serif;overflow:hidden;border:1px solid var(--line-soft,rgba(128,128,128,.2))}
.kline-asset .mkt-logo img{width:100%;height:100%;object-fit:cover}
.kline-names{min-width:0}
.kline-names b{display:block;font:700 16px sans-serif;color:var(--text,#e8edf5)}
.kline-names span{display:block;font-size:11px;color:var(--muted,#8a97a8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.kline-pricerow{display:flex;align-items:baseline;gap:10px;flex:0 0 auto}
.kline-last{font:700 20px/1.2 monospace;font-variant-numeric:tabular-nums;color:var(--text,#e8edf5)}
.kline-chg{font:700 12px monospace;padding:3px 8px;border-radius:7px}
.kline-chg.up{color:var(--green,#36c995);background:rgba(54,201,149,.13)}
.kline-chg.down{color:var(--red,#ef6873);background:rgba(239,104,115,.13)}
.kline-tfs{display:flex;gap:5px;flex:0 0 auto;background:var(--surface-2,#141c2c);border:1px solid var(--line,rgba(128,128,128,.25));border-radius:9px;padding:3px}
.kline-tf{border:0;background:none;color:var(--muted,#8a97a8);font:700 11px monospace;padding:5px 10px;border-radius:7px;cursor:pointer;transition:.15s}
.kline-tf:hover{color:var(--text,#e8edf5)}
.kline-tf.on{background:var(--brand,#08e7f7);color:#07101f}
.kline-src{flex:0 0 auto;font:700 10px monospace;color:var(--brand,#08e7f7);background:var(--brand-soft,rgba(8,231,247,.12));padding:3px 8px;border-radius:6px;letter-spacing:.04em}
.kline-close{border:0;background:none;color:var(--muted,#8a97a8);font-size:22px;line-height:1;cursor:pointer;padding:0 4px;flex:0 0 auto;transition:.15s}
.kline-close:hover{color:var(--red,#ef6873)}
.kline-body{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.kline-legend{flex:0 0 auto;padding:7px 14px;font:600 11px monospace;color:var(--muted,#8a97a8);border-bottom:1px solid var(--line-soft,rgba(128,128,128,.15));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(6,10,18,.5)}
.kline-canvas-wrap{flex:1;min-height:0;position:relative}
.kline-canvas-wrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.kline-state{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--muted,#8a97a8);font-size:13px;text-align:center;padding:20px;z-index:5;background:rgba(6,10,18,.55)}
.kline-state .kline-err{font-size:15px;font-weight:700;color:var(--text,#e8edf5)}
.kline-spin{width:30px;height:30px;border-radius:50%;border:3px solid var(--brand-soft,rgba(8,231,247,.12));border-top-color:var(--brand,#08e7f7);animation:klineSpin .8s linear infinite}
@keyframes klineSpin{to{transform:rotate(360deg)}}
.kline-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 16px;border-top:1px solid var(--line-soft,rgba(128,128,128,.15));font-size:11px;color:var(--muted,#8a97a8);flex-wrap:wrap}
.kline-foot a{color:#4f8cff;text-decoration:none;border-bottom:1px dashed rgba(79,140,255,.4)}
@media(max-width:820px){.kline-mask{padding:0}.kline-modal{width:100%;height:100vh;height:100dvh;min-height:0;border:0;border-radius:0}.kline-head{gap:10px;padding:11px 12px}.kline-tf{padding:6px 9px}}`;

function ensureKlineStyle(){
  if(document.getElementById('klineStyle'))return;
  const st=document.createElement('style');
  st.id='klineStyle';
  st.textContent=KLINE_CSS;
  document.head.appendChild(st);
}

function dsSearchUrl(c){
  const q=c&&c.token||c&&c.symbol||'';
  return 'https://dexscreener.com/search?q='+encodeURIComponent(q);
}

export function closeKlineModal(){
  if(klineCtx){disposeTradingChart(klineCtx.canvas);klineCtx=null}
  const m=document.getElementById('klineMask');
  if(m){if(m._esc)document.removeEventListener('keydown',m._esc);m.remove()}
  document.body.classList.remove('kline-lock');
}

function showKlineState(kind,msg){
  const s=document.getElementById('klineState');if(!s)return;
  const retry='<button class="terminal-btn" id="klineRetry" style="margin-top:14px">↻ Retry</button>';
  if(kind==='loading')s.innerHTML='<div class="kline-spin"></div><div>Loading chart…</div>';
  else if(kind==='error')s.innerHTML=`<div class="kline-err">⚠ API Error</div><div style="opacity:.8;margin-top:6px">${escapeHTML(msg||'Data source temporarily unavailable')}</div>${retry}`;
  else if(kind==='network')s.innerHTML=`<div class="kline-err">⚠ Network connection error</div><div style="opacity:.8;margin-top:6px">${escapeHTML(msg||'Check your connection and try again.')}</div>${retry}`;
  else s.innerHTML=`<div class="kline-err">No chart data</div><div style="opacity:.8;margin-top:6px">This token may be newly listed or have insufficient trading volume. Please try again later.${isDexCoin(klineCur)?`<br><a href="${escapeHTML(dsSearchUrl(klineCur))}" target="_blank" rel="noreferrer" style="color:#4f8cff">View external market →</a>`:''}</div>${retry}`;
  const r=document.getElementById('klineRetry');if(r)r.onclick=()=>loadKlineIntoModal();
}

async function loadKlineIntoModal(){
  const mask=document.getElementById('klineMask');if(!mask)return;
  showKlineState('loading','');
  const c=klineCur,tf=klineTf;
  const chain=normChain(c.chain),token=c.token||'',symbol=c.symbol||'';
  const isContract=isContractAddr(token)&&isDexCoin(c);
  let candles=[],src='';
  try{
    // 1) On-ChainContract：GMGN On-Chain DEX K \u7ebf\u4f18\u5148（2026-08-09 Data Source\u7b56\u7565）
    if(isContract){
      try{
        const gk=await api.gmgnKline(chain,token,GMGN_RES[tf]||'1h');
        const gc=(gk&&gk.ok)?asArray(gk.data):[];
        if(gc.length){candles=gc;src='On-Chain Market'}
      }catch(e){}
    }
    // 2) \u540e\u7aef /api/kline：On-Chain\u5e01\u8d70 GT DEX  Pools，CEX \u5e01\u8d70 Binance
    if(!candles.length){
      try{
        const kl=await api.kline(symbol,tf,400,isContract?token:'',isContract?chain:'');
        candles=asArray(kl.candles);
        src=isContract?'On-Chain Market':'Market Data';
      }catch(e){throw e}
    }
    if(!candles.length){
      showKlineState('empty','');
      return;
    }
    // \u5934\u90e8Last Price = \u6700\u540e\u4e00\u6839\u6536\u76d8\u4ef7
    const last=candles[candles.length-1];
    if(last&&last.close!=null){
      const p=document.getElementById('klineLast');if(p)p.textContent=money(last.close);
      const pc=candles.length>1?candles[candles.length-2].close:null;
      if(pc&&pc>0){
        const d=(last.close-pc)/pc*100;
        const el=document.getElementById('klineChg');
        if(el){el.textContent=percent(d);el.className='kline-chg '+(d>=0?'up':'down')}
      }
    }
    const s=document.getElementById('klineSrc');if(s)s.textContent=src;
    const legend=document.getElementById('klineLegend');if(legend)legend.textContent=`${c.symbol||''} · Hover to view OHLCV`;
    const cv=document.getElementById('klineCanvas');
    if(klineCtx){disposeTradingChart(klineCtx.canvas);klineCtx=null}
    klineCtx=drawTradingChart(cv,candles,{showMA:true,legendEl:document.getElementById('klineLegend')});
    const st=document.getElementById('klineState');if(st)st.style.display='none';
  }catch(e){
    showKlineState(errKind(e),e&&e.message||String(e));
  }
}

export function openKlineModal(coin){
  ensureKlineStyle();
  closeKlineModal();
  klineCur=coin||{};klineTf='1h';
  const c=klineCur;
  const chg=Number(c.priceChange24h??c.change_24h??0);
  const logo=c.logo||c.icon?`<img src="${escapeHTML(c.logo||c.icon)}" alt="">`:`${escapeHTML((c.symbol||'?').slice(0,3))}`;
  const chainName=c.chainName||String(c.chain||'market').toUpperCase();
  const mask=document.createElement('div');
  mask.id='klineMask';
  mask.className='kline-mask';
  mask.innerHTML=`<div class="kline-modal">
    <div class="kline-head">
      <div class="kline-asset"><div class="mkt-logo">${logo}</div><div class="kline-names"><b>${escapeHTML(c.symbol||'—')}</b><span title="${escapeHTML(c.name||'')}">${escapeHTML(c.name||'—')} · ${escapeHTML(chainName)}</span></div></div>
      <div class="kline-pricerow"><div class="kline-last" id="klineLast">${money(c.priceUsd??c.price)}</div><div class="kline-chg ${chg>=0?'up':'down'}" id="klineChg">${percent(chg)}</div></div>
      <div class="kline-tfs">${KLINE_TFS.map(t=>`<button class="kline-tf${t.k===klineTf?' on':''}" data-tf="${t.k}">${t.label}</button>`).join('')}</div>
      <span class="kline-src" id="klineSrc">—</span>
      <button class="kline-close" title="Close (Esc)">×</button>
    </div>
    <div class="kline-body">
      <div class="kline-legend" id="klineLegend">${escapeHTML(c.symbol||'')} · Hover to view OHLCV</div>
      <div class="kline-canvas-wrap"><canvas id="klineCanvas"></canvas><div class="kline-state" id="klineState"></div></div>
    </div>
    <div class="kline-foot"><span>Market Data · Switchable intervals · Scroll to zoom</span>${c.token?`<a href="/v2/token/${escapeHTML(normChain(c.chain))}/${encodeURIComponent(c.token||'')}" target="_blank" rel="noreferrer">Full Token Details →</a>`:''}</div>
  </div>`;
  mask.addEventListener('mousedown',e=>{if(e.target===mask)closeKlineModal()});
  document.body.appendChild(mask);
  document.body.classList.add('kline-lock');
  const closeBtn=mask.querySelector('.kline-close');
  closeBtn.onclick=closeKlineModal;
  const esc=e=>{if(e.key==='Escape')closeKlineModal()};
  document.addEventListener('keydown',esc);
  mask._esc=esc;
  mask.querySelectorAll('.kline-tf').forEach(b=>{
    b.onclick=()=>{
      mask.querySelectorAll('.kline-tf').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      klineTf=b.dataset.tf;
      loadKlineIntoModal();
    };
  });
  setTimeout(loadKlineIntoModal,80);
}
