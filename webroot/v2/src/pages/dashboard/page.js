import {api} from '../../services/api.js';
import {money,compact,percent,escapeHTML} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {navigate} from '../../app/router.js';
import {asArray, asObject, isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, skeleton} from '../../utils/render.js';
import {closeKlineModal} from '../../components/kline-modal.js';
import {visibleTokens,hideOnAvatarError} from '../../services/token-avatar.js';

const metric=(label,value,sub,cls='')=>`<article class="metric-card"><div class="metric-label">${label}</div><div class="metric-value ${cls}">${value}</div><div class="metric-sub">${sub}</div></article>`;
const rank=(title,rows,value,cls='')=>`<section class="panel ranking-panel"><div class="panel-head"><h2>${title}</h2><span>TOP 5</span></div>${asArray(rows).slice(0,5).map((x,i)=>{const v=value(x),tone=cls||(Number(v)>=0?'up':'down');return`<div class="ranking-row"><b>${i+1}</b><span>${x.symbol}</span><strong class="${tone}">${typeof v==='number'?percent(v):v}</strong></div>`}).join('')}</section>`;
const liqRank=(title,rows)=>`<section class="panel ranking-panel"><div class="panel-head"><h2>${title}</h2><span>TOP 5</span></div>${asArray(rows).slice(0,5).map((x,i)=>`<div class="ranking-row"><b>${i+1}</b><span>${x.symbol}</span><strong class="warn">${compact(x.liquidations_24h)}</strong></div>`).join('')}</section>`;
const hubFeatures=[
  {path:'/v2/markets',icon:'⌁',title:'Markets',en:'MARKET DATA',desc:'Top assets, Binance Alpha, Solana and Ethereum live markets'},
  {path:'/v2/radar',icon:'◉',title:'On-Chain Radar',en:'ON-CHAIN INTELLIGENCE',desc:'Discover tokens, liquidity pools, trading flows and holder changes'},
  {path:'/v2/futures',icon:'⇄',title:'Futures',en:'FUTURES TERMINAL',desc:'Monitor price, open interest, funding rates and liquidation risk'},
  {path:'/v2/smartmoney',icon:'✣',title:'Smart Money',en:'WALLET INTELLIGENCE',desc:'Track high-performing wallets and their latest capital movements'},
  {path:'/v2/alpha',icon:'◎',title:'Alpha Radar',en:'ALPHA INTELLIGENCE',desc:'Detect early projects, market anomalies and emerging opportunities'},
  {path:'/v2/risk',icon:'◇',title:'Risk Control',en:'RISK INTELLIGENCE',desc:'Analyze contract safety, holder concentration and abnormal trades'},
  {path:'/v2/strategies',icon:'↗',title:'Strategy Center',en:'OFFICIAL & PRIVATE STRATEGIES',desc:'Run verified signals and build a private factor-weighted strategy'},
  {path:'/v2/chat',icon:'▦',title:'AI Chat',en:'AI ANALYST',desc:'Research markets, analyze tokens and develop trading strategies'},
  {path:'/v2/user',icon:'♙',title:'Account Center',en:'USER WORKSPACE',desc:'Manage your account, watchlists and personal settings'},
];
const hubCard=(item,status='Online')=>`<button class="terminal-hub-card" data-hub-path="${item.path}" type="button"><span class="terminal-hub-icon">${item.icon}</span><span class="terminal-hub-copy"><b>${item.title}</b><small>${item.en}</small><em>${item.desc}</em></span><span class="terminal-hub-state"><i></i>${status}</span><span class="terminal-hub-arrow">→</span></button>`;

export async function renderDashboard(root){
  let timer,liveTimer,lastSymbols=[];root.innerHTML=skeleton({cards:4,panels:1,rows:6,cols:9});
  // 2026-08-07 \u6027\u80fd\u4f18\u5316：\u6570\u636e\u5feb\u7167\u5bf9\u6bd4，NoneChange\u8df3\u8fc7\u91cd\u7ed8（\u4fdd\u7559\u6eda\u52a8\u4f4d\u7f6e\u4e0eEnter\u7126\u70b9）
  const snap={current:null};
  const paint=async()=>{
    const [topRaw,macroRaw,qkRaw]=await Promise.all([api.marketTop(),api.marketOverview().catch(()=>({})),api.marketsQualified().catch(()=>null)]);
    if(!isMounted(root))return;
    const top=asObject(topRaw),macro=asObject(macroRaw),coins=visibleTokens(top.coins),global=asObject(macro.global),btc=coins.find(x=>x.symbol==='BTC');
    const qk=asObject(qkRaw),qualified=visibleTokens(asArray(qk.coins).filter(x=>x&&x.chain!=='market'));
    lastSymbols=coins.map(c=>c.token||c.symbol).filter(Boolean);
    const featureHtml=hubFeatures.map((item,index)=>hubCard(item,index===0&&qualified.length?qualified.length+' Assets':'Online')).join('');
    const marketTone=Number(global.market_cap_change_24h)>=1?'Bullish':Number(global.market_cap_change_24h)<=-1?'Bearish':'Neutral';
    const html=`<div class="page-head terminal-home-head"><div><h1>AI Crypto Intelligence Terminal</h1><p>Market, on-chain, risk and trading intelligence console</p></div><div class="page-actions"><span class="status-live">● SYSTEM ONLINE · PRICE 2S · FULL DATA 30S</span></div></div><div class="overview-grid">${metric('Global Crypto Market Cap',compact(global.market_cap_usd),'24H '+percent(global.market_cap_change_24h),Number(global.market_cap_change_24h)>=0?'up':'down')}${metric('BTC Dominance',percent(global.btc_dominance),'Market Structure','warn')}${metric('24H Volume',compact(global.volume_24h_usd),'Spot Market')}${metric('BTC / USD',money(btc?.price),'24H '+percent(btc?.change_24h),Number(btc?.change_24h)>=0?'up':'down')}</div><section class="panel terminal-hub"><div class="panel-head"><h2>INTELLIGENCE TERMINAL · FUNCTION MATRIX</h2><span>FULL-FEATURE QUICK ACCESS</span></div><div class="terminal-hub-grid">${featureHtml}</div></section><section class="terminal-intel-grid"><article class="panel terminal-intel-card"><span>Market Trend</span><b class="${Number(global.market_cap_change_24h)>=0?'up':'down'}">${marketTone}</b><small>Global market cap 24H ${percent(global.market_cap_change_24h)}</small></article><article class="panel terminal-intel-card"><span>Market Coverage</span><b>${qualified.length||'No Data'}</b><small>Live data for the fixed asset pool</small></article><article class="panel terminal-intel-card"><span>BTC Momentum</span><b class="${Number(btc?.change_24h)>=0?'up':'down'}">${percent(btc?.change_24h)}</b><small>Latest market price ${money(btc?.price)}</small></article></section><section class="panel market-monitor"><div class="panel-head"><h2>MARKET SUMMARY · TOP 10</h2><span>LIVE MARKET DATA · AUTO REFRESH</span></div><div class="table-scroll"><table class="market-table pro-table no-click"><thead><tr><th># / ASSET</th><th>PRICE</th><th>24H</th><th>MARKET CAP</th><th>VOLUME</th><th>LONG/SHORT</th><th>OI</th><th>FUNDING</th><th>LIQUIDATION 24H</th></tr></thead><tbody>${coins.slice(0,10).map(c=>`<tr data-symbol="${escapeHTML(c.symbol)}"><td><div class="asset"><span class="rank-id">${c.rank}</span>${c.logo?`<img class="coin-logo" src="${escapeHTML(c.logo)}" alt="" loading="lazy">`:`<span class="coin-icon">${escapeHTML(c.symbol.slice(0,3))}</span>`}<span class="asset-name"><b>${escapeHTML(c.name)}</b><span>${escapeHTML(c.symbol)}${c.chain?` · ${escapeHTML(c.chain)}`:''}</span></span></div></td><td>${money(c.price)}</td><td class="${c.change_24h>=0?'up':'down'}">${percent(c.change_24h)}</td><td>${compact(c.market_cap)}</td><td>${compact(c.volume_24h)}</td><td>${c.onchain?(c.event_count!=null?c.event_count+' Trades':'—'):(c.long_short_ratio?Number(c.long_short_ratio).toFixed(2):'—')}</td><td>${c.onchain?(c.liquidity_usd!=null?compact(c.liquidity_usd):'—'):compact(c.open_interest)}</td><td>${c.onchain?(c.pair_count!=null?c.pair_count+' Pools':'—'):(c.funding_rate==null?'—':(c.funding_rate*100).toFixed(4)+'%')}</td><td class="warn">${compact(c.liquidations_24h)}</td></tr>`).join('')}</tbody></table></div><div class="terminal-market-more"><button class="terminal-btn primary" data-hub-path="/v2/markets">VIEW ALL MARKETS →</button></div></section>`;
    if (unchanged(snap, html)) return; // \u6570\u636eNoneChange：\u8df3\u8fc7 DOM \u91cd\u5199
    snap.current = snapshot(html);
    withScroll(root, '.table-scroll', () => { root.innerHTML = html; });
    root.querySelectorAll('img.coin-logo').forEach(img=>img.addEventListener('error',hideOnAvatarError,{once:true}));
    root.querySelectorAll('[data-hub-path]').forEach(el=>el.onclick=()=>navigate(el.dataset.hubPath));
    renderAIRail();
  };
  // 2026-08-07 Live Price\u8986\u76d6：\u72ec\u7acb 5s \u8f6e\u8be2 Binance \u5b9e\u65f6\u73b0\u8d27\u4ef7，\u4ec5Refresh PRICE/24H%/VOLUME \u5355\u5143\u683c（\u4e0d\u91cd\u7ed8\u6574\u8868，\u4fdd\u7559\u6eda\u52a8\u4e0e\u4ea4\u4e92）
  const overlayLive=async()=>{try{
    if(!lastSymbols.length)return;
    const res=await api.priceLive(lastSymbols);const map=(res&&res.prices)||{};if(!map||!Object.keys(map).length)return;
    root.querySelectorAll('.market-monitor tbody tr[data-symbol]').forEach(tr=>{const p=map[tr.getAttribute('data-symbol')];if(!p)return;const td=tr.children;
      if(td[1])td[1].textContent=money(p.price);
      if(td[2]){td[2].textContent=percent(p.change_24h);td[2].className=(Number(p.change_24h)>=0?'up':'down');}
      if(td[4])td[4].textContent=compact(p.volume_24h);});
  }catch{}};
  try{await paint();overlayLive();liveTimer=setInterval(overlayLive,2000);timer=setInterval(()=>paint().catch(()=>{}),30000)}catch(e){root.innerHTML=`<div class="empty-page"><b>Global market data is unavailable</b><p>${e.message}</p></div>`;renderAIRail()}return()=>{clearInterval(timer);clearInterval(liveTimer);closeKlineModal();}
}
