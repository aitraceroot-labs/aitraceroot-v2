import {api} from '../../services/api.js';
import {money,compact,percent,number,escapeHTML} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';
import {skeleton} from '../../utils/render.js';

// ══════════════════════════════════════════════════════════════════
// Futures Terminal · ON-CHAIN DERIVATIVES NEXUS ON-CHAIN \u4e3b\u7ec8\u7aef + GLOBAL EXCHANGE DERIVATIVES MONITOR CEX Reference
// Data Source：ON-CHAIN DERIVATIVES NEXUS On-Chain\u6c38\u7eed\u6570\u636e（\u514d\u8d39·\u514dKey·CORS \u5168\u5f00·On-Chain\u53ef\u9a8c\u8bc1）
//         + \u540e\u7aef GLOBAL EXCHANGE DERIVATIVES MONITOR \u9762\u677f（CEX \u5bf9\u7167，\u964d\u7ea7\u4e0d\u963b\u585e Page\u9762）
// 2026-08-09 \u91cd\u6784：\u4ea7\u54c1\u91cd\u5fc3\u4e3aOn-Chain DEX \u6570\u636e，CEX Contract\u4f5c\u4e3a\u53c2\u8003\u5bf9\u7167
// ══════════════════════════════════════════════════════════════════

const HL_BASE = 'https://api.hyperliquid.xyz/info';
const HL_WS = 'wss://api.hyperliquid.xyz/ws';

const funding=v=>v==null?'—':(Number(v)*100).toFixed(4)+'%';
const cgFunding=v=>v==null?'—':Number(v).toFixed(4)+'%';
const pct=(v,digits=2)=>v==null?'—':(Number(v)*100).toFixed(digits)+'%';
const ratio=v=>v==null?'—':Number(v).toFixed(2);
const hlFunding=v=>v==null?'—':(Number(v)*100).toFixed(5)+'%';
const hlMoney=v=>v==null?'—':compact(Number(v));
// ON-CHAIN DERIVATIVES NEXUS POST \u8bf7\u6c42（\u6d4f\u89c8\u5668\u76f4\u8fde）
async function hlPost(payload, timeout=15000){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(HL_BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal});
    if(!r.ok)throw new Error('HL HTTP '+r.status);
    return await r.json();
  }catch(e){if(e?.name==='AbortError')throw new Error('HL Request timed out');throw e}
  finally{clearTimeout(t)}
}

// 2026-08-11 \u4fee\u590d（\u67e5\u6e05\u6e05\u5355 #4）：HL \u6570\u636e\u5feb\u7167\u5171\u4eab。
// allMids \u8f7b\u91cf 5s TTL；metaAndAssetCtxs \u91cd\u578b 30s TTL。
// refresh(5s) \u4e0e refreshHLPanel(30s) \u7edf\u4e00\u901a\u8fc7 hlSnapshot() \u53d6\u6570，\u907f\u514d\u6bcf 5s \u91cd\u590d\u62c9\u5168\u91cf\u5143\u6570\u636e。
const _hlCache={mids:null,midsT:0,ctxs:null,ctxsT:0};
const HL_MIDS_TTL=5000, HL_CTXS_TTL=30000;
async function hlSnapshot(){
  const now=Date.now();
  const m=(_hlCache.mids&&now-_hlCache.midsT<=HL_MIDS_TTL)?_hlCache.mids:null;
  const c=(_hlCache.ctxs&&now-_hlCache.ctxsT<=HL_CTXS_TTL)?_hlCache.ctxs:null;
  const [mm,cc]=await Promise.all([
    m?Promise.resolve(m):hlPost({type:'allMids'}).then(x=>{_hlCache.mids=x;_hlCache.midsT=Date.now();return x}).catch(()=>_hlCache.mids),
    c?Promise.resolve(c):hlPost({type:'metaAndAssetCtxs'}).then(x=>{_hlCache.ctxs=x;_hlCache.ctxsT=Date.now();return x}).catch(()=>_hlCache.ctxs),
  ]);
  return {mids:mm||_hlCache.mids, ctxs:cc||_hlCache.ctxs};
}

// horizontal bars（reuse clean styles）
const bars=(rows,max=5,formatter=v=>compact(Number(v)||0),maxVal)=>`<div class="cg-bars">${asArray(rows).slice(0,max).map(x=>{const v=Number(x.value??x.usd??x.flow_usd??x.funding_rate??0)||0;const m=maxVal||Math.max(1,...asArray(rows).slice(0,max).map(r=>Math.abs(Number(r.value??r.usd??r.flow_usd??r.funding_rate??0)||0)));const w=Math.max(2,Math.min(100,Math.abs(v)/m*100));const tone=typeof x.tone==='number'?(x.tone>=0?'up':'down'):'warn';return`<div class="cg-bar-row"><span>${escapeHTML(x.label)}</span><div class="cg-bar-track"><i class="${tone}" style="width:${w}%"></i></div><b>${formatter(v)}</b></div>`}).join('')}</div>`;

export async function renderFutures(root){
  let timer,cgTimer,hlTimer,coin,coins=[],cg={},stopped=false,hl={},hlErr='';

  root.innerHTML=skeleton({cards:0,panels:1,rows:3,cols:3});
  try{
    // ── \u521d\u59cb\u5316：\u5e01\u79cd\u5217\u8868 = ON-CHAIN DERIVATIVES NEXUS \u6c38\u7eed universe（\u4f18\u5148）∪ watchboard Contract
    let hlMeta=null;
    try{hlMeta=await hlPost({type:'meta'})}catch(e){console.warn('HL meta failed',e)}
    const hlCoins=asArray(hlMeta?.universe).map(x=>String(x?.name||'').toUpperCase()).filter(Boolean);
    let wbCoins=[];try{wbCoins=asArray((await api.watchboard())?.coins).filter(c=>c?.has_futures&&String(c?.symbol||c?.label||'').split('(')[0].toUpperCase())}catch(e){console.warn('watchboard load failed',e)}
    const wbNames=wbCoins.map(c=>String(c?.symbol||c?.label||'').split('(')[0].toUpperCase());
    const list=[...new Set([...hlCoins.slice(0,60),...wbNames])];  // \u524d60 AssetsHLContract + watchboard Contract
    coin={symbol:list[0]||'BTC'};coins=list.map(s=>({symbol:s}));

    // ── \u9996\u5c4f：HL \u5feb\u7167（\u5171\u4eab\u5feb\u7167，\u4e0d\u91cd\u590d\u62c9\u53d6）
    let mids={},ctxs=[];
    try{const snap=await hlSnapshot();mids=snap.mids||{};ctxs=Array.isArray(snap.ctxs)?snap.ctxs:[];hl.ok=!!(snap.mids&&snap.ctxs)}catch(e){hlErr=e.message;console.warn('HL snapshot failed',e)}

    const shell=()=>{
      if(stopped||!isMounted(root))return;
      const s=String(coin.symbol||'BTC').toUpperCase();
      const ctx=s=>{const row=ctxs.find((x,i)=>String(hlMeta?.universe?.[i]?.name||'').toUpperCase()===s);return row};
      const mrow=ctx(s);
      root.innerHTML=`<div class="page-head"><div><h1>Derivatives Terminal</h1><p>NEXUS PERPETUAL · GLOBAL EXCHANGE DERIVATIVES MONITOR CEX REFERENCE</p></div><div class="page-actions"><span class="engine-state"><i class="status-dot ${hl.ok?'':'off'}"></i><small>${hl.ok?'NEXUS LIVE':'ON-CHAIN DERIVATIVES NEXUS UNAVAILABLE'}</small></span><select id="pairSelect" class="terminal-select">${coins.map(c=>{const x=String(c.symbol).toUpperCase();return`<option value="${escapeHTML(x)}" ${x===s?'selected':''}>${escapeHTML(x)} PERP</option>`}).join('')}</select></div></div>
      <section class="futures-head"><div class="futures-pair"><b id="fPair">${escapeHTML(s)}</b><span>ON-CHAIN DERIVATIVES NEXUS</span></div>${[['MARK PRICE','fMark'],['FUNDING','fFunding'],['OPEN INTEREST','fOI'],['24H Volume','fVol'],['24H Change','fChg']].map(x=>`<div class="quote-stat"><span>${x[0]}</span><b id="${x[1]}">—</b></div>`).join('')}</section>
      ${hlErr?`<div class="empty-page"><b>ON-CHAIN DERIVATIVES NEXUS on-chain data unavailable</b><p>${escapeHTML(hlErr)} · Using backend contract data as a fallback</p></div>`:''}
      <div class="derivatives-grid">${[['ON-CHAIN DERIVATIVES NEXUS Funding','dFlow'],['ON-CHAIN DERIVATIVES NEXUS Open Interest','dTrades'],['ON-CHAIN DERIVATIVES NEXUS 24H Trades','dLongLiq'],['ON-CHAIN DERIVATIVES NEXUS Mark Price','dShortLiq'],['Global Long/Short(CEX)','dGlobal'],['Whale Long/Short(CEX)','dTop']].map(x=>`<article class="panel mini-panel"><span>${x[0]}</span><b id="${x[1]}">—</b></article>`).join('')}</div>
      <div class="risk-strip" id="riskStrip"><b>⚡ ON-CHAIN DERIVATIVES RADAR</b><span id="riskText">assessing</span><strong id="riskScore">0 / 100</strong></div>
      <section class="panel cg-panel"><div class="panel-head"><h2>NEXUS · TOP CONTRACTS</h2><span id="hlStamp">DATA ENGINE</span></div>
        <div class="cg-grid">
          <div class="cg-stat"><span>ON-CHAIN DERIVATIVES NEXUS Perpetual Markets</span><b id="hlCount">—</b></div>
          <div class="cg-stat"><span>ON-CHAIN DERIVATIVES NEXUS 24H Total Volume</span><b id="hlTotVlm">—</b></div>
          <div class="cg-stat"><span>ON-CHAIN DERIVATIVES NEXUS Funding Range</span><b id="hlFundRange">—</b></div>
          <div class="cg-stat"><span>ON-CHAIN DERIVATIVES NEXUS Top Asset by Open Interest</span><b id="hlTopOi">—</b></div>
          <div class="cg-stat"><span>ON-CHAIN DERIVATIVES NEXUS Top Asset by 24H Volume</span><b id="hlTopVlm">—</b></div>
          <div class="cg-stat"><span>Data Source</span><b id="hlSrc">ON-CHAIN DERIVATIVES NEXUS API</b></div>
        </div>
        <div class="cg-rows">
          <div class="cg-block"><div class="cg-block-title">Funding Ranking (All Markets)</div><div id="hlFundEx"><div class="cg-empty">Waiting for data…</div></div></div>
          <div class="cg-block"><div class="cg-block-title">24H Volume Ranking</div><div id="hlVlmEx"><div class="cg-empty">Waiting for data…</div></div></div>
        </div>
      </section>
      <section class="panel cg-panel"><div class="panel-head"><h2>GLOBAL EXCHANGE DERIVATIVES MONITOR · ${escapeHTML(s)} <span style="font-size:11px;color:#f4b728;border:1px solid #f4b72866;border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">CEX Reference</span></h2><span id="cgStamp">DATA ENGINE</span></div>
        <div class="cg-grid">
          <div class="cg-stat"><span>Fear & Greed</span><b id="cgFng">—</b></div>
          <div class="cg-stat"><span>24H Total Liquidations</span><b id="cgLiq">—</b></div>
          <div class="cg-stat"><span>Long / Short Liquidations</span><b id="cgLiqLS">—</b></div>
          <div class="cg-stat"><span>Global Account Long/Short</span><b id="cgGlobal">—</b></div>
          <div class="cg-stat"><span>Whale Position Long/Short</span><b id="cgTop">—</b></div>
          <div class="cg-stat"><span>Whale Account Long/Short</span><b id="cgTopAcc">—</b></div>
          <div class="cg-stat"><span>OI 30M Change</span><b id="cgOiChg">—</b></div>
          <div class="cg-stat"><span>Binance Funding</span><b id="cgFunding">—</b></div>
        </div>
        <div class="cg-rows">
          <div class="cg-block"><div class="cg-block-title">OI Exchange Distribution</div><div id="cgOiEx"><div class="cg-empty">Waiting for data…</div></div></div>
          <div class="cg-block"><div class="cg-block-title">Funding Rate by Exchange</div><div id="cgFundingEx"><div class="cg-empty">Waiting for data…</div></div></div>
        </div>
        <div id="cgEtf"></div>
      </section>`;
      const select=root.querySelector('#pairSelect');
      if(select)select.onchange=async e=>{
        try{const next=coins.find(c=>String(c.symbol).toUpperCase()===e.target.value);if(!next)return;coin=next;hl={};shell();await refresh();await refreshCG()}catch(error){console.warn('Derivatives pair switch failed',error)}
      };
    };

    // ── ON-CHAIN DERIVATIVES NEXUS \u4e3b\u7ec8\u7aefRefresh（Price/Funding/OI/\u8ba2\u5355\u7c3f/Trades）
    const refresh=async()=>{
      if(stopped||!isMounted(root)||!coin)return;
      const s=String(coin.symbol||'BTC').toUpperCase();
      const set=(id,v,cls)=>{const el=root.querySelector('#'+id);if(el){el.textContent=v;if(cls)el.className=cls}};
      try{
        const {mids:m,ctxs:cArr}=await hlSnapshot();
        if(stopped||!isMounted(root))return;
        const uni=asArray(cArr?.[0]?.universe||[]);const ctxs=asArray(cArr?.[1]);
        const idx=uni.findIndex(u=>String(u?.name||'').toUpperCase()===s);
        const ctx=idx>=0?ctxs[idx]:null;
        const price=Number(m?.[s]??ctx?.markPx??0);
        if(price)set('fMark',money(price),price>Number(hl.lastPrice||0)?'up':'down');
        hl.lastPrice=price;
        if(ctx){
          set('fFunding',hlFunding(ctx.funding),Number(ctx.funding)>=0?'down':'up');
          const oiUsd=Number(ctx.openInterest)*price;
          set('fOI',hlMoney(oiUsd));
          set('fVol',hlMoney(ctx.dayNtlVlm));
          const chg=Number(ctx.prevDayPx)?(price/Number(ctx.prevDayPx)-1)*100:null;
          set('fChg',chg==null?'—':pct(chg/100),chg>=0?'up':'down');
          set('dFlow',hlFunding(ctx.funding),Number(ctx.funding)>=0?'down':'up');
          set('dTrades',hlMoney(oiUsd));
          set('dLongLiq',hlMoney(ctx.dayNtlVlm));
          set('dShortLiq',money(price));
        }
        renderAIRail();
      }catch(e){console.warn('HL refresh failed',e);hlErr=e.message}
    };

    // ── ON-CHAIN DERIVATIVES NEXUS All Markets\u9762\u677f（30s）：\u6392\u884c/\u6c47\u603b
    const refreshHLPanel=async()=>{
      if(stopped||!isMounted(root))return;
      try{
        const {mids:m,ctxs:cArr}=await hlSnapshot();
        if(stopped||!isMounted(root))return;
        const uni=asArray(cArr?.[0]?.universe||[]);const ctxs=asArray(cArr?.[1]);
        const rows=uni.map((u,i)=>{const x=ctxs[i];const px=Number(m?.[u.name]??x?.markPx??0);return{name:String(u.name).toUpperCase(),funding:Number(x?.funding||0),oi:Number(x?.openInterest||0)*px,vlm:Number(x?.dayNtlVlm||0),px}}).filter(r=>r.vlm>0);
        const set=(id,v)=>{const el=root.querySelector('#'+id);if(el)el.textContent=v};
        set('hlCount',String(uni.length));
        set('hlTotVlm',hlMoney(rows.reduce((a,r)=>a+r.vlm,0)));
        const fr=rows.filter(r=>Math.abs(r.funding)>1e-9).map(r=>r.funding);
        set('hlFundRange',fr.length?`${(Math.min(...fr)*100).toFixed(4)}% ~ ${(Math.max(...fr)*100).toFixed(4)}%`:'—');
        const topOi=[...rows].sort((a,b)=>b.oi-a.oi)[0];
        const topVlm=[...rows].sort((a,b)=>b.vlm-a.vlm)[0];
        set('hlTopOi',topOi?`${topOi.name} · ${hlMoney(topOi.oi)}`:'—');
        set('hlTopVlm',topVlm?`${topVlm.name} · ${hlMoney(topVlm.vlm)}`:'—');
        const fundEl=root.querySelector('#hlFundEx');
        if(fundEl)fundEl.innerHTML=bars(rows.sort((a,b)=>Math.abs(b.funding)-Math.abs(a.funding)).slice(0,8).map(r=>({label:r.name,value:Number(r.funding)*100,tone:Number(r.funding)>=0?1:-1})),8,v=>v.toFixed(4)+'%');
        const vlmEl=root.querySelector('#hlVlmEx');
        if(vlmEl)vlmEl.innerHTML=bars(rows.sort((a,b)=>b.vlm-a.vlm).slice(0,8).map(r=>({label:r.name,value:r.vlm,tone:1})),8,v=>compact(v));
        const stamp=root.querySelector('#hlStamp');if(stamp)stamp.textContent='ON-CHAIN DERIVATIVES NEXUS · '+new Date().toLocaleTimeString('en-US',{hour12:false});
        // Derivatives\u96f7\u8fbe：\u7efc\u5408Funding\u6781\u503c\u4e0eTrades\u6d3b\u8dc3\u5ea6
        const maxAbs=Math.max(0.0001,...rows.map(r=>Math.abs(r.funding)));
        hl.riskScore=Math.min(100,Math.round(Math.max(0,(maxAbs-0.0001)*200000+Math.min(30,rows.length/3))));
        const riskEl=root.querySelector('#riskText');const riskScoreEl=root.querySelector('#riskScore');
        if(riskEl&&riskScoreEl){
          riskScoreEl.textContent=`${hl.riskScore} / 100`;
          riskEl.textContent=maxAbs>0.001?`Extreme funding ${(maxAbs*100).toFixed(4)}%，Extreme leverage crowding detected.`:maxAbs>0.0003?`Elevated funding（${(maxAbs*100).toFixed(4)}%），Leverage sentiment is rising.`:'Current on-chain derivatives funding is stable.';
        }
      }catch(e){console.warn('HL panel failed',e)}
    };

    // ── GLOBAL EXCHANGE DERIVATIVES MONITOR CEX Reference\u9762\u677f（\u4fdd\u6301\u539f\u903b\u8f91，\u4ec5\u6807\u6ce8\u53c2\u8003）
    const refreshCG=async()=>{
      if(stopped||!isMounted(root)||!coin)return;
      try{
        const data=asObject(await api.coinglassTerminal(String(coin.symbol||'BTC').toUpperCase()));
        if(stopped||!isMounted(root))return;
        cg=data;
        const set=(id,v,cls)=>{const el=root.querySelector('#'+id);if(el){el.textContent=v;if(cls)el.className=cls}};
        const fg=asObject(data.fear_greed);
        const fgValue=Number(fg?.fear_greed ?? fg?.value);
        set('cgFng',fgValue==null||Number.isNaN(fgValue)?'—':`${fgValue} · ${escapeHTML(fg.value_classification||fg.classification||'')}`,fgValue<=25?'down':fgValue>=75?'up':'warn');
        const liq=asObject(data.liquidation);
        set('cgLiq',liq?.liq_24h_usd==null?'—':compact(liq.liq_24h_usd),'warn');
        set('cgLiqLS',(liq?.long_liq_24h==null||liq?.short_liq_24h==null)?'—':`${compact(liq.long_liq_24h)} / ${compact(liq.short_liq_24h)}`);
        const g=asObject(data.global_long_short),tp2=asObject(data.top_position_long_short),ta=asObject(data.top_account_ratio);
        set('cgGlobal',ratio(g?.ratio));set('cgTop',ratio(tp2?.ratio));set('cgTopAcc',ratio(ta?.ratio));
        const oiEx=asArray(data.oi_exchange);
        set('cgOiChg',(()=>{const rows=asArray(data.oi_history);if(rows.length<2)return '—';const prev=Number(rows[0].close)||0,last=Number(rows[rows.length-1].close)||0;if(!prev||!last)return '—';const chg=(last/prev-1)*100;return `${compact(last)} (${pct(chg/100)})`})());
        const fundEx=asArray(data.funding_exchange);
        const binanceFund=fundEx.find(x=>String(x.exchange).toLowerCase()==='binance');
        set('cgFunding',cgFunding(binanceFund?.funding_rate ?? fundEx[0]?.funding_rate),Number(binanceFund?.funding_rate??fundEx[0]?.funding_rate)>=0?'down':'up');
        const oiExEl=root.querySelector('#cgOiEx');
        if(oiExEl)oiExEl.innerHTML=oiEx.length?bars(oiEx.map(x=>({label:x.exchange,value:x.oi_usd,tone:1}))):'<div class="cg-empty">No data</div>';
        const fundExEl=root.querySelector('#cgFundingEx');
        if(fundExEl)fundExEl.innerHTML=fundEx.length?bars(fundEx.map(x=>({label:x.exchange,value:Number(x.funding_rate),tone:Number(x.funding_rate)>=0?1:-1})),6,v=>Number(v).toFixed(4)+'%'):'<div class="cg-empty">No data</div>';
        const etfEl=root.querySelector('#cgEtf');
        if(etfEl&&asArray(data.etf_flow).length){
          const flows=asArray(data.etf_flow);
          etfEl.innerHTML=`<div class="cg-block-title">BTC ETF 7D Funding Flow</div>${bars(flows.map(f=>({label:new Date(Number(f.timestamp||0)*1000).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'}),value:f.flow_usd,tone:Number(f.flow_usd)>=0?1:-1})),7,v=>compact(v))}`;
        }
        const stamp=root.querySelector('#cgStamp');if(stamp)stamp.textContent='GLOBAL EXCHANGE DERIVATIVES MONITOR · CEX REFERENCE · '+new Date().toLocaleTimeString('en-US',{hour12:false});
      }catch(error){console.warn('GLOBAL EXCHANGE DERIVATIVES MONITOR panel refresh failed',error)}
    };

    shell();await refresh();await refreshHLPanel();await refreshCG();
    timer=setInterval(()=>{refresh().catch(error=>console.warn('HL refresh failed',error))},5000);
    hlTimer=setInterval(()=>{refreshHLPanel().catch(error=>console.warn('HL panel failed',error))},30000);
    cgTimer=setInterval(()=>{refreshCG().catch(error=>console.warn('CG refresh failed',error))},30000);
  }catch(e){
    if(isMounted(root))root.innerHTML=`<div class="empty-page"><b>Futures load failed</b><p>${escapeHTML(e?.message)}</p></div>`;
    renderAIRail();
  }
  return()=>{stopped=true;clearInterval(timer);clearInterval(cgTimer);clearInterval(hlTimer)};
}
