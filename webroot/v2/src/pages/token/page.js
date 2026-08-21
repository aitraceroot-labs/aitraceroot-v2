// Token\u8be6\u60c5 Page（GeckoTerminal \u98ce\u683c\u5e03\u5c40）：
// \u5de6\u4e3b\u5217 = K\u7ebf（\u5468\u671f\u5207\u6362 + Price/Volume + OHLCV legend）+ \u4e0b\u65b9Tags\u5316\u6570\u636e\u533a\u5757（Trades/Top Holders/Smart Money/Large Transfers/Liquidity Pools）
// \u53f3\u4fa7\u56fa\u5b9a\u680f = Token\u4fe1\u606f（Name/Contract Address/Chain/DEX/\u5b9e\u65f6Price/Mkt Cap/Liquidity/Market Depth\u8fd1\u4f3c/AI \u8bc4\u5206/\u5916Chain）
// \u684c\u9762 grid \u53cc\u5217；\u79fb\u52a8\u7aef\u5355\u5217\u5806\u53e0（K\u7ebf → \u6570\u636e\u533a\u5757 → \u4fe1\u606f\u680f）
// 2026-08-09 \u63d0\u901f\u6539\u9020：K\u7ebf\u4f18\u5148\u6e32\u67d3（ Page\u9762\u4e3b\u4f53 1-2s \u51fa\u56fe），\u4ea4\u6613/Holdings/Smart Money/Security audit\u540e\u53f0\u5e76\u884c\u586b\u5145
import {api} from '../../services/api.js';
import {money,compact,percent,escapeHTML} from '../../utils/format.js';
import {drawTradingChart,disposeTradingChart,sma,ema,rsi,boll} from '../../charts/terminal-chart.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray} from '../../utils/safe.js';
import {skeleton} from '../../utils/render.js';
import {collapseCard, bindCollapse} from '../../components/collapse-card.js';

const periods=[['1m','1m'],['5m','5m'],['15m','15m'],['30m','30m'],['1H','1h'],['4H','4h'],['1D','1d'],['1W','1w']];
function macd(v){const a=ema(v,12),b=ema(v,26),m=v.map((_,i)=>a[i]-b[i]),s=ema(m,9);return m.at(-1)-s.at(-1)}
const short=a=>a?`${String(a).slice(0,6)}…${String(a).slice(-4)}`:'—';
const evRow=e=>`<div class="console-row"><i class="status-dot ${Number(e.usd)>=0?'':'off'}"></i><div><b>${escapeHTML(e.label||'On-Chain Moves')}</b><small>${escapeHTML(String(e.from||'').slice(0,8))} → ${escapeHTML(String(e.to||'').slice(0,8))} · ${timeStr(e.time)}</small></div><strong class="${Number(e.usd)>=0?'up':'down'}">${money(e.usd)}</strong></div>`;
const timeStr=t=>{if(!t)return'—';const d=new Date(t*1000);return`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const CHAIN_NAME={bsc:'BNB Chain',eth:'Ethereum',base:'Base',arbitrum:'Arbitrum One',polygon:'Polygon',solana:'Solana'};
const EXPLORER={bsc:'https://bscscan.com',eth:'https://etherscan.io',base:'https://basescan.org',arbitrum:'https://arbiscan.io',polygon:'https://polygonscan.com',solana:'https://solscan.io'};
const EVM_CHAINS=['bsc','eth','base','arbitrum','polygon'];
const isEvmChain=ch=>EVM_CHAINS.includes(ch||'');

// DexScreener \u515c\u5e95：tokenSnapshot \u5931\u8d25（\u5982 Solana）\u65f6\u6784\u9020\u57fa\u7840\u4fe1\u606f
async function _dsFallback(address){
  try{
    const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+address.toLowerCase(),{headers:{'User-Agent':'Mozilla/5.0'}});
    if(!r.ok)return null;
    const d=await r.json(),pairs=d.pairs||[];
    if(!pairs.length)return null;
    const best=pairs.slice().sort((a,b)=>Number((b.liquidity||{}).usd||0)-Number((a.liquidity||{}).usd||0))[0];
    const base=best.baseToken||{};
    return {symbol:base.symbol||'',name:base.name||'',price_usd:best.priceUsd,price_change_24h:(best.priceChange||{}).h24,
      volume_24h:(best.volume||{}).h24,liquidity_usd:(best.liquidity||{}).usd,market_cap:best.fdv||best.marketCap,
      dex:best.dexId,url:best.url,pair_address:best.pairAddress};
  }catch{return null}
}

// \u5f02\u6b65\u4efb\u52a1\u5de5\u5177：\u5e76\u884c\u964d\u7ea7\u53d6 K \u7ebf（GMGN \u4e0e\u540e\u7aef\u5e76\u884c，\u8c01\u5148\u6210\u529f\u7528\u8c01；\u90fd\u5931\u8d25\u518d GeckoTerminal \u76f4\u8fde → DexScreener Pools\u515c\u5e95）
async function _fetchKlines(coin,isContract,chain,address,tokenData,dsf){
  const out={candles:[],klineSource:'none'};
  const gmgnP=(isContract&&['sol','bsc','base','eth'].includes(chain))?api.gmgnKline(chain,address,'1h').then(gk=>{
    const gc=(gk&&gk.ok)?asArray(gk.data):[];
    return gc.length?{candles:gc,klineSource:'gmgn'}:null;
  }).catch(e=>{console.warn('[token] gmgn kline failed:',e.message);return null}):Promise.resolve(null);
  const backP=api.kline(coin.symbol,'1h',400,isContract?address:'',isContract?chain:'').then(kl=>{
    const kc=asArray(kl.candles);
    return kc.length?{candles:kc,klineSource:kl.source||'backend'}:null;
  }).catch(e=>{console.warn('[token] backend kline failed:',e.message);return null});
  const [g,b]=await Promise.all([gmgnP,backP]);
  if(g&&g.candles.length){out.candles=g.candles;out.klineSource=g.klineSource;return out}
  if(b&&b.candles.length){out.candles=b.candles;out.klineSource=b.klineSource;return out}
  if(isContract&&tokenData.primary){
    try{
      const pairAddr=tokenData.primary.pairAddress||tokenData.primary.address;
      if(pairAddr){
        const gtChainMap={eth:'ethereum',bsc:'bsc',base:'base',arbitrum:'arbitrum',polygon:'polygon',solana:'solana'};
        const gtNet=gtChainMap[chain]||chain;
        const gr=await fetch(`https://api.geckoterminal.com/api/v2/networks/${gtNet}/pools/${pairAddr}/klines/candlesticks?aggregate=1h&limit=200`,{headers:{'User-Agent':'Mozilla/5.0'}});
        if(gr.ok){
          const gd=await gr.json(),gtCandles=asArray(gd?.data?.attributes?.candles)||[];
          if(gtCandles.length){out.candles=gtCandles.map(c=>({time:Math.floor(new Date(c[0]).getTime()/1000),open:Number(c[1]),high:Number(c[2]),low:Number(c[3]),close:Number(c[4]),volume:Number(c[5])}));out.klineSource='gecko-direct';return out}
        }
      }
    }catch(e2){console.warn('[token] gecko direct kline failed:',e2.message)}
  }
  if(isContract&&dsf&&dsf.pair_address){
    try{
      const dsChainMap={eth:'ethereum',bsc:'bsc',base:'base',arbitrum:'arbitrum',polygon:'polygon'};
      const dsNet=dsChainMap[chain]||chain;
      const dr=await fetch(`https://api.geckoterminal.com/api/v2/networks/${dsNet}/pools/${dsf.pair_address}/klines/candlesticks?aggregate=1h&limit=200`,{headers:{'User-Agent':'Mozilla/5.0'}});
      if(dr.ok){
        const dd=await dr.json(),dsCandles=asArray(dd?.data?.attributes?.candles)||[];
        if(dsCandles.length){out.candles=dsCandles.map(c=>({time:Math.floor(new Date(c[0]).getTime()/1000),open:Number(c[1]),high:Number(c[2]),low:Number(c[3]),close:Number(c[4]),volume:Number(c[5])}));out.klineSource='gecko-dsfallback';return out}
      }
    }catch{}
  }
  return out;
}

export async function renderToken(root,route){
  let timer,chartInst=null;
  const parts=route.path.split('/').filter(Boolean);
  const isContract=parts.length>=4;
  const chain=isContract?decodeURIComponent(parts[2]).toLowerCase():'';  // 2026-08-09：\u5165\u53e3\u7edf\u4e00\u5c0f\u5199（watchboard \u7ed9\u5927\u5199 ETH/BSC）
  const address=isContract?decodeURIComponent(parts.slice(3).join('/')):'';
  const symbol=isContract?'':decodeURIComponent(parts.at(-1)).toUpperCase();
  root.innerHTML=skeleton({cards:0,panels:1,rows:5,cols:5,chart:true});
  try{
    // ===== 1. \u89e3\u6790 coin（\u552f\u4e00\u524d\u7f6e\u4f9d\u8d56，2026-08-09：monitor \u77ed\u8d85\u65f6 4s \u4f18\u5148，\u5931\u8d25\u624d\u8d70 DexScreener \u515c\u5e95）=====
    let coin,tokenData={},dsf=null;
    if(isContract){
      if(isEvmChain(chain)){
        try{tokenData=await api.tokenSnapshot(chain,address)}catch{tokenData={}}
      }
      const p=tokenData.primary;
      if(p){
        coin={symbol:p.baseToken?.symbol,name:p.baseToken?.name,price_usd:p.priceUsd,price_change_24h:p.priceChange?.h24,
          volume_24h:p.volume?.h24,liquidity_usd:p.liquidity?.usd,token:address,chain,market_cap:p.marketCap||p.fdv};
      }else{
        dsf=await _dsFallback(address);
        if(dsf)coin={...dsf,token:address,chain};
        if(!coin)throw new Error('No active pair for this contract');
      }
    }else{
      try{
        const top=await api.marketTop();
        const c=(top.coins||[]).find(x=>x.symbol===symbol);
        if(c)coin={symbol:c.symbol,name:c.name,price_usd:c.price,price_change_24h:c.change_24h,volume_24h:c.volume_24h,liquidity_usd:null,token:symbol,chain:'global',market_cap:c.market_cap};
        else{const wb=(await api.watchboard());coin=(wb.coins||[]).find(x=>(x.symbol||x.label||'').split('(')[0].toUpperCase()===symbol);if(coin){coin={symbol:coin.symbol,name:coin.name,price_usd:coin.price,price_change_24h:coin.change_24h,volume_24h:coin.volume_24h,liquidity_usd:null,token:symbol,chain:'global',market_cap:coin.market_cap}}}
      }catch(symErr){console.warn('[token] symbol lookup failed:',symErr.message)}
    }
    if(!coin)throw new Error('Asset not indexed');
    const isEvm=isEvmChain(chain);
    const td=isEvm?tokenData:{};
    const transfers=asArray(td.transfers),buys=asArray(td.buys),sells=asArray(td.sells),addrEvs=asArray(td.addr_events),holders=asArray(td.top_holders);
    const cName=CHAIN_NAME[chain]||chain||'—';
    const exUrl=(td.explorer||EXPLORER[chain]||'https://etherscan.io');
    const addrPath=chain==='solana'?'/token/':'/address/';
    const dsUrl=(dsf&&dsf.url)||(td.primary&&td.primary.url)||'https://dexscreener.com/search?q='+encodeURIComponent(address||symbol);
    const iLinks=isContract?[
      {name:'External Market',url:dsUrl},
      {name:'Chain\u6d4f\u89c8\u5668',url:exUrl+addrPath+encodeURIComponent(address)},
      {name:'AICoin',url:'https://www.aicoin.com/search?key='+encodeURIComponent(address)},
      {name:'CMC',url:'https://coinmarketcap.com/zh/search/?q='+encodeURIComponent(address)}
    ]:[];

    // ===== 2. \u5e76\u884c\u542f\u52a8All\u6570\u636e\u4efb\u52a1（\u4e0d\u963b\u585e\u9996\u5c4f\u6e32\u67d3）=====
    const klineTask=_fetchKlines(coin,isContract,chain,address,tokenData,dsf);
    const tradesTask=isContract?(async()=>{
      let trades=[],pools=[],tradeSource='backend';
      try{
        const [tradeRes,poolRes]=await Promise.allSettled([api.onchainTrades(chain,address,30),api.onchainPools(chain,address)]);
        let trRaw=tradeRes.status==='fulfilled'?tradeRes.value:null;
        if(!trRaw){trRaw=await api.tokenTrades(chain,address)}
        const tArr=asArray(trRaw?.data?.trades||trRaw?.trades);
        if(coin.price_usd&&coin.price_usd>0){
          const priceRange=[coin.price_usd*0.01,coin.price_usd*100];
          const validTrades=tArr.filter(t=>{const p=Number(t.price_usd);return p>=priceRange[0]&&p<=priceRange[1]});
          if(validTrades.length>0)trades=validTrades;
          else if(tArr.length>0){trades=tArr;tradeSource='unfiltered'}
          else tradeSource='empty';
        }else{trades=tArr}
        pools=poolRes.status==='fulfilled'?asArray(poolRes.value?.data?.pools):asArray(trRaw?.pools);
      }catch(e){console.warn('[token] trades failed:',e.message);tradeSource='error'}
      if(trades.length===0&&dsf&&dsf.pair_address){
        try{
          const dtr=await fetch(`https://api.dexscreener.com/latest/dex/pairs/${dsf.pair_address}`,{headers:{'User-Agent':'Mozilla/5.0'}});
          if(dtr.ok){
            const dtd=await dtr.json(),pair=dtd?.pair;
            if(pair?.data){
              const dsTrades=(asArray(pair.data.trades)||asArray(pair.data.transactions)||[]).slice(0,15).map(t=>({
                tx:t.txid||t.hash||'',time:Math.floor(new Date(t.time||t.blockTime||Date.now()).getTime()/1000),
                from:t.from||t.taker||t.account||'',kind:(t.side||t.type||t.buyer==='me')?'buy':'sell',
                price_usd:t.price||t.unitPrice||coin.price_usd,amount_in:t.amount||t.amountIn||'0',amount_out:t.amountOut||'0'
              }));
              if(dsTrades.length)trades=dsTrades;tradeSource='dexscreener'
            }
          }
        }catch{}
      }
      return {trades,pools,tradeSource};
    })():Promise.resolve({trades:[],pools:[],tradeSource:'backend'});
    const smTask=(async()=>{
      let smMatched=[],smSym=coin.symbol||symbol,smSolCount=0,smTraders=null;
      try{
        const smRaw=await api.smartMoneyHolders(isContract?(isEvm?chain:''):'',isContract?(isEvm?address:symbol):symbol);
        smMatched=asArray(smRaw.matched);smSym=smRaw.symbol||smSym;smSolCount=smRaw.sol_wallet_count||0;
      }catch{}
      //  Top Traders（GMGN top_traders ，2026-08-11 ）
      if(isContract&&['sol','bsc','base','eth'].includes(chain)){
        try{const tr=await api.smartMoneyTraders(chain,address,20);if(tr&&tr.ok)smTraders={traders:asArray(tr.traders),source:tr.source,updated_at:tr.updated_at,list_updated_at:tr.list_updated_at}}catch{}
      }
      return {smMatched,smSym,smSolCount,smTraders};
    })();
    const gmgnTask=(isContract&&['sol','bsc','base','eth'].includes(chain))?(async()=>{
      // \u4e32\u884c\u8bf7\u6c42\u907f\u514d\u89e6\u53d1 GMGN \u9650\u6d41（429）
      let gmgnHolders=[],gmgnPools=[],gmgnSm=[],gmgnSec=null,holderStats=null;
      try{const gh=await api.gmgnHolders(chain,address,20).catch(()=>null);if(gh&&gh.ok)gmgnHolders=asArray(gh.data)}catch{}
      try{const hs=await api.holderStats(chain,address).catch(()=>null);if(hs&&hs.ok)holderStats=hs}catch{}
      try{const gp=await api.gmgnPool(chain,address).catch(()=>null);if(gp&&gp.ok)gmgnPools=asArray(gp.data)}catch{}
      try{const gs=await api.gmgnSmartMoney(chain,20).catch(()=>null);if(gs&&gs.ok)gmgnSm=asArray(gs.data)}catch{}
      try{const gsec=await api.gmgnSecurity(chain,address).catch(()=>null);if(gsec&&gsec.ok)gmgnSec=gsec.data}catch{}
      return {gmgnHolders,gmgnPools,gmgnSm,gmgnSec,holderStats};
    })():Promise.resolve({gmgnHolders:[],gmgnPools:[],gmgnSm:[],gmgnSec:null,holderStats:null});
    const cnoteTask=isContract?(async()=>{
      try{const ctList=asArray(await api.customTokens().catch(()=>[]));return ctList.find(x=>(x.token||'').toLowerCase()===String(address||'').toLowerCase())||{}}catch{return{}}
    })():Promise.resolve({});

    // ===== 3. \u6e32\u67d3 Page\u9762\u4e3b\u4f53（\u6570\u636e\u533a\u5360\u4f4d，K \u7ebf\u4e0d\u963b\u585e）=====
    const score=Math.round(Math.max(0,Math.min(100,62+(Number(coin.price_change_24h)||0)*2)));
    const loadingRow='<tr><td colspan="5" class="cg-empty">Loading data…</td></tr>';
    const evmOnly=`<div class="empty-page" style="padding:26px"><b>\u8be5\u6570\u636e\u4ec5\u652f\u6301 EVM Chain</b><p>${chain==='solana'?'Solana Chain\u7684Holdings\u5206\u5e03\u4e0eSmart MoneyTags\u5df2\u652f\u6301；Large Transfers\u76d1\u63a7\u4e3a\u4e8c\u671f\u5de5\u7a0b。':'On-Chain Monitor（holders / Large Transfers / Whale Moves）BSC only/ETH when on-chain perps available。Use Wallet Trace to track any address。'}</p></div>`;
    root.innerHTML=`<style>
      .gt-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start;margin-top:14px}
      .gt-main{min-width:0}
      .gt-side{position:sticky;top:14px;display:flex;flex-direction:column;gap:14px;max-height:calc(100vh - 28px);overflow-y:auto;scrollbar-width:thin}
      .gt-side::-webkit-scrollbar{width:4px}
      .chart-panel .chart-wrap{height:430px}
      .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
      .chart-panel{height:auto}
      .gt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}
      .gt-tabs button{padding:6px 14px;font-size:12px;background:rgba(128,128,128,.08);border:1px solid rgba(128,128,128,.18);border-radius:8px;color:inherit;cursor:pointer;transition:all .15s}
      .gt-tabs button:hover{border-color:rgba(79,140,255,.4)}
      .gt-tabs button.active{background:rgba(79,140,255,.16);border-color:rgba(79,140,255,.5);color:#8ab6ff}
      .gt-tab-body{display:none}
      .gt-tab-body.active{display:block;animation:fadeIn .18s ease}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .holder-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 14px 4px}
      .holder-metric{background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.12);border-radius:10px;padding:10px 12px}
      .holder-metric span{display:block;font-size:10px;color:var(--muted,#8a97a8);margin-bottom:5px;letter-spacing:.04em}
      .holder-metric b{font:700 16px/1.2 monospace;font-variant-numeric:tabular-nums;color:var(--text,#e8edf5)}
      .holder-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px}
      .holder-toolbar .terminal-input{flex:1 1 220px;min-width:160px}
      .holder-extra{font-size:11px;color:var(--muted,#8a97a8);margin-left:auto}
      .holder-extra b{color:var(--text,#e8edf5);font-weight:600}
      .holder-extra b.warn{color:#f4b728}
      .holder-table td{white-space:nowrap}
      .holder-table .h-rank{font:700 11px monospace;color:var(--muted,#8a97a8)}
      .h-addr-cell{display:flex;align-items:center;gap:5px}
      .h-addr{font:600 12px monospace;color:#8ab6ff;text-decoration:none;border-bottom:1px dashed rgba(138,182,255,.35)}
      .h-addr:hover{color:#a8c6ff}
      .h-copy{border:0;background:none;color:var(--muted,#8a97a8);font-size:12px;cursor:pointer;padding:0 2px;opacity:.7;transition:.15s}
      .h-copy:hover{opacity:1;color:var(--brand,#08e7f7)}
      .h-tag-btn{border:1px solid rgba(199,146,234,.35);background:rgba(199,146,234,.08);color:#c792ea;border-radius:5px;padding:2px 6px;font:700 9px monospace;cursor:pointer}
      .h-tag-btn:hover{background:rgba(199,146,234,.18)}
      .h-amt{font:600 12px monospace;font-variant-numeric:tabular-nums}
      .h-pct-cell{min-width:130px}
      .h-pct{display:inline-block;width:74px;height:7px;background:rgba(128,128,128,.14);border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:7px}
      .h-pct i{display:block;height:100%;background:linear-gradient(90deg,#08e7f7,#4f8cff);border-radius:4px}
      .h-pct-cell b{font:600 11px monospace}
      .h-usd{font:600 12px monospace;font-variant-numeric:tabular-nums}
      .h-tags{display:flex;gap:5px;flex-wrap:wrap}
      .h-tag{display:inline-block;padding:2px 6px;border-radius:5px;font:700 9px monospace;letter-spacing:.03em}
      .h-tag.up{color:#20d99a;background:rgba(32,217,154,.14)}
      .h-tag.down{color:#ff5f6d;background:rgba(255,95,109,.14)}
      .h-tag.exch{color:#8ab6ff;background:rgba(138,182,255,.14)}
      .h-tag.new{color:#f4b728;background:rgba(244,183,40,.14)}
      .h-tag.sus{color:#ff9f43;background:rgba(255,159,67,.15)}
      .h-tag.smart{color:#c792ea;background:rgba(199,146,234,.16)}
      @media(max-width:960px){
        .holder-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .holder-extra{margin-left:0;width:100%}
      }
      @media(max-width:600px){.holder-metrics{grid-template-columns:1fr 1fr}.holder-table .h-pct{width:56px}}
      @media(max-width:600px){.token-header{flex-wrap:wrap}.token-header .token-price{min-width:0;max-width:100%;flex:1 1 100%;display:flex;align-items:baseline;gap:10px}.token-price b{font-size:17px}.token-price span{white-space:nowrap}}
      .gt-price-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
      .gt-price-row b{font-size:22px}
      @media(max-width:960px){
        .gt-layout{grid-template-columns:1fr}
        .gt-side{position:static;max-height:none;overflow:visible}
        .chart-panel .chart-wrap{height:320px}
        .gt-tabs{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px}
        .gt-tabs button{flex:none}
      }
    </style>
    <div class="token-header pro-token"><span class="token-logo">${escapeHTML((coin.symbol||'?').slice(0,3))}</span><div class="token-title"><h1>${escapeHTML(coin.name||coin.symbol)} <small>${escapeHTML(coin.symbol||'')}</small></h1><p>${escapeHTML(cName.toUpperCase())} · ${escapeHTML(String(coin.token||''))}</p></div>${isContract?'<button class="terminal-btn" id="tradeJump" type="button">Trades <span id="tradeJumpCount">…</span></button>':''}<div class="token-price"><b>${money(coin.price_usd)}</b><span class="${Number(coin.price_change_24h)>=0?'up':'down'}">${percent(coin.price_change_24h)} · 24H</span></div></div>
    <div class="gt-layout">
      <div class="gt-main">
        <section class="panel chart-panel pro-chart">
          <div class="panel-head"><h2>${escapeHTML(coin.symbol)} / USD</h2><span id="ohlcvLegend">REAL-TIME PRICE ACTION</span></div>
          <div class="toolbar timeframe-bar">${periods.map((x,i)=>`<button class="seg-btn ${i===4?'active':''}" data-tf="${x[1]}">${x[0]}</button>`).join('')}<span class="indicator-toggles"><button class="seg-btn active" data-ind="ma">MA</button><button class="seg-btn active" data-ind="ema">EMA</button><button class="seg-btn active" data-ind="boll">BOLL</button><button class="seg-btn active" data-ind="macd">MACD</button><button class="seg-btn" data-ind="rsi">RSI</button><button class="seg-btn" data-ind="kdj">KDJ</button></span></div>
          <div class="chart-wrap"><canvas id="tokenChart"></canvas><div class="chart-empty" id="chartEmpty" style="padding:28px;text-align:center"><b style="font-size:14px">K \u7ebfLoading…</b><p style="opacity:.6;margin-top:6px;font-size:12px">\u6b63\u5728\u8bf7\u6c42On-Chain\u6570\u636e\u6e90</p></div></div>
        </section>
        <div class="gt-tabs">
          <button data-tab="trades" class="active">Trades</button>
          <button data-tab="holders">Top Holders</button>
          <button data-tab="smart">Smart Money</button>
          <button data-tab="transfers">Large Transfers</button>
          <button data-tab="pools">Liquidity Pools</button>
        </div>
        <div class="gt-tab-bodies">
          <div data-body="trades" class="gt-tab-body active"><section class="panel"><div class="panel-head"><h2>Trade History · RECENT TRADES</h2><span id="tradesHead">Loading…</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>TIME</th><th>Side</th><th>Wallet</th><th>Trade Value</th><th>TOKEN Amount</th><th>Price</th><th>DEX</th><th>TX</th></tr></thead><tbody id="tradesBody"><tr><td colspan="8" class="cg-empty">Loadingreal trades…</td></tr></tbody></table></div></section></div>
          <div data-body="holders" class="gt-tab-body">${isContract?`<section class="panel"><div class="panel-head"><h2>Top Holders</h2><span id="holdersHead">Collecting…</span></div><div class="holder-metrics" id="holderMetrics"><div class="holder-metric"><span>Total Holders</span><b>—</b></div><div class="holder-metric"><span>TOP10 Share</span><b>—</b></div><div class="holder-metric"><span>Smart MoneyShare</span><b>—</b></div><div class="holder-metric"><span>New Wallets</span><b>—</b></div></div><div class="holder-toolbar"><input id="holderSearch" class="terminal-input" placeholder="Search\u6301\u6709\u4ebaAddress…" autocomplete="off" spellcheck="false"><button id="holderRefresh" class="terminal-btn">↻ Refresh</button><span class="holder-extra" id="holderExtra"></span></div><div class="table-scroll"><table class="market-table holder-table"><thead><tr><th>#</th><th>Address</th><th>Amount</th><th>Share</th><th>USD</th><th>Trend / Tags</th></tr></thead><tbody id="holderBody"><tr><td colspan="6" class="cg-empty">Collecting holders…</td></tr></tbody></table></div></section>`:evmOnly}</div>
          <div data-body="smart" class="gt-tab-body">${(isEvm||chain==='solana')?`<section class="panel"><div class="panel-head"><h2>SMART MONEY HOLDERS</h2><span id="smHead">Loading…</span></div><div id="smSlot"><div class="empty-page" style="padding:20px"><b>Smart MoneyLoading data…</b><p>\u6b63\u5728\u67e5\u8be2On-ChainSmart Money\u4ea4\u6613\u6d41</p></div></div></section>`:evmOnly}</div>
          <div data-body="transfers" class="gt-tab-body">${isEvm?`<section class="panel"><div class="panel-head"><h2>Large Transfer Timeline</h2><span>${transfers.length} TRANSFERS · ≥ $5K</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>TIME</th><th>FROM → TO</th><th>AMOUNT</th><th>USD</th><th>TX</th></tr></thead><tbody>${transfers.slice(0,8).map(e=>`<tr><td>${timeStr(e.time)}</td><td>${short(e.from)} → ${short(e.to)}</td><td>${Number(e.amount||0).toLocaleString('zh-CN',{maximumFractionDigits:4})}</td><td class="warn">${money(e.usd)}</td><td><a class="tx-link" href="${escapeHTML(exUrl)}/tx/${escapeHTML(e.tx)}" target="_blank" rel="noreferrer">View</a></td></tr>`).join('')||'<tr><td colspan="5" class="cg-empty">No large transfers</td></tr>'}</tbody></table></div></section>`:evmOnly}</div>
          <div data-body="pools" class="gt-tab-body">${isContract?`<section class="panel"><div class="panel-head"><h2>Liquidity Pools · LIQUIDITY POOLS</h2><span id="poolsHead">Loading…</span></div><div style="padding:14px" id="depthTab"><div class="cg-empty"> PoolsLoading data…</div><p style="font-size:11px;opacity:.5;margin-top:8px">DEX \u4e3a AMM \u673a\u5236has no order book，\u6b64\u56fe\u5c55\u793a\u5404 PoolsLiquidity\u5206\u5e03（\u8fd1\u4f3cMarket Depth）</p></div></section>`:`<div class="empty-page" style="padding:26px"><b>CEX mainstream asset</b><p>Liquidity Pools\u6570\u636e\u4ec5\u5bf9On-ChainContractToken\u53ef\u7528。</p></div>`}</div>
        </div>
      </div>
      <aside class="gt-side">
        <div id="secSlot"></div>
        <section class="panel"><div class="panel-head"><h2>Project Information</h2><span>${escapeHTML(cName.toUpperCase())}${coin.dex?` · ${escapeHTML(coin.dex)}`:''}</span></div><div class="info-grid" style="display:grid;grid-template-columns:1fr;gap:10px;padding:14px">
          <div style="display:flex;align-items:center;gap:10px">${coin.logo?`<img src="${escapeHTML(coin.logo)}" style="width:40px;height:40px;border-radius:50%">`:`<span class="token-logo" style="width:40px;height:40px;font-size:13px">${escapeHTML((coin.symbol||'?').slice(0,3))}</span>`}<div><b style="font-size:15px">${escapeHTML(coin.name||coin.symbol)}</b><span style="opacity:.55;margin-left:6px">${escapeHTML(coin.symbol||'')}</span></div></div>
          ${isContract?`<div><span style="font-size:11px;opacity:.6">Contract Address</span><div style="display:flex;gap:6px;align-items:center;margin-top:4px"><code style="font-size:12px;word-break:break-all;opacity:.9">${escapeHTML(address)}</code><button class="seg-btn" data-copy="${escapeHTML(address)}" style="flex:none;padding:2px 10px;font-size:12px">Copy</button></div></div>`:''}
          <div><span style="font-size:11px;opacity:.6">Description</span><p style="margin:4px 0 0;font-size:13px;opacity:.85" id="noteText">NoneDescription · \u53ef\u70b9\u51fb\u4e0b\u65b9Chain\u63a5View\u9879\u76ee\u4e3b Page</p></div>
          ${isContract?`<div><span style="font-size:11px;opacity:.6">\u76f8\u5173Chain\u63a5</span><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${iLinks.map(l=>`<a class="tx-link" href="${escapeHTML(l.url)}" target="_blank" rel="noreferrer">${l.name} ↗</a>`).join('')}</div></div>`:''}
        </div></section>
        <section class="panel"><div class="panel-head"><h2>Market Data</h2><span>${isContract?'DEX On-Chain':'CEX \u53c2\u8003'}</span></div><div class="derivatives-grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:14px">
          <article class="panel mini-panel" style="grid-column:1/-1"><span>\u5b9e\u65f6Price</span><b style="font-size:20px">${money(coin.price_usd)}</b><span class="${Number(coin.price_change_24h)>=0?'up':'down'}" style="font-size:12px">${percent(coin.price_change_24h)} · 24H</span></article>
          <article class="panel mini-panel"><span>Mkt Cap / FDV</span><b>${compact(coin.market_cap)}</b></article>
          <article class="panel mini-panel"><span>24H Volume</span><b>${compact(coin.volume_24h)}</b></article>
          <article class="panel mini-panel"><span>Liquidity</span><b>${compact(coin.liquidity_usd)}</b></article>
          <article class="panel mini-panel"><span>BuySell Trades\u6570</span><b>${buys.length||sells.length?`${buys.length}/${sells.length}`:'—'}</b></article>
          <article class="panel mini-panel"><span>RSI 14</span><b id="rsiVal">—</b></article>
          <article class="panel mini-panel"><span>MACD</span><b id="macdVal">—</b></article>
        </div></section>
        <section class="panel"><div class="panel-head"><h2>Market Depth · DEPTH</h2><span>AMM \u591a Pools\u8fd1\u4f3c</span></div><div style="padding:14px" id="depthSide"><div class="cg-empty"> PoolsLoading data…</div><p style="font-size:11px;opacity:.5;margin-top:8px">AMM has no order book，\u4ee5\u5404 PoolsLiquidityShare\u8fd1\u4f3c\u6df1\u5ea6</p></div></section>
        <section class="panel"><div class="panel-head"><h2>AI MARKET INTELLIGENCE</h2><span>0-100</span></div><div class="ai-score-large">${score}</div>${[['Trend Score',score],['Flow Score',Math.max(20,score-7)],['Technical Score',55],['Sentiment Score',Math.max(25,score-4)],['Risk Score',Math.max(15,100-score)]].map(x=>`<div class="factor-row"><span>${x[0]}</span><i><b style="width:${x[1]}%"></b></i><strong>${x[1]}</strong></div>`).join('')}<div class="ai-advice"><b>${score>=70?'Uptrend':'Range Watch'}</b><p>${score>=70?'wait for pullback，avoid chasing。':'wait for trend & flow alignment。'}</p><span>Risk：${score>=70?'Medium':'Med-High'}</span></div></section>
      </aside>
    </div>`;
    // ---------- \u4ea4\u4e92\u7ed1\u5b9a ----------
    let candles=[];
    const loadTf=async(tf,btn)=>{
      try{const r=await api.kline(coin.symbol,tf,400,isContract?address:'',isContract?chain:'');candles=asArray(r?.candles);if(!candles.length&&isContract&&tokenData.primary){
        const pairAddr=tokenData.primary.pairAddress||tokenData.primary.address;
        if(pairAddr){const gtChainMap={eth:'ethereum',bsc:'bsc',base:'base',arbitrum:'arbitrum',polygon:'polygon',solana:'solana'},gtNet=gtChainMap[chain]||chain;
        try{const gr=await fetch(`https://api.geckoterminal.com/api/v2/networks/${gtNet}/pools/${pairAddr}/klines/candlesticks?aggregate=${tf}&limit=200`,{headers:{'User-Agent':'Mozilla/5.0'}});
        if(gr.ok){const gd=await gr.json(),gc=asArray(gd?.data?.attributes?.candles)||[];if(gc.length)candles=gc.map(c=>({time:Math.floor(new Date(c[0]).getTime()/1000),open:Number(c[1]),high:Number(c[2]),low:Number(c[3]),close:Number(c[4]),volume:Number(c[5])}))}}catch{}}}
      }catch{}
      const c2=root.querySelector('#tokenChart');
      if(c2){if(candles.length){if(chartInst)chartInst.setData(candles);else chartInst=drawTradingChart(c2,candles,{legendEl:root.querySelector('#ohlcvLegend'),indicators:{ma:true,ema:true,boll:true,macd:true,rsi:false,kdj:false}})}else if(chartInst)chartInst.setData([])}
      root.querySelectorAll('.timeframe-bar > button[data-tf]').forEach(b=>b.classList.toggle('active',b===btn))
    };
    const mountChart=(data)=>{
      const cv=root.querySelector('#tokenChart');
      if(!cv)return;
      const ce=root.querySelector('#chartEmpty');
      if(ce)ce.remove();
      if(chartInst)chartInst.setData(data);
      else chartInst=drawTradingChart(cv,data,{legendEl:root.querySelector('#ohlcvLegend'),indicators:{ma:true,ema:true,boll:true,macd:true,rsi:false,kdj:false}});
    };
    root.querySelectorAll('.timeframe-bar > button[data-tf]').forEach(btn=>btn.onclick=()=>{const tf=btn.dataset.tf;const idx=periods.findIndex(x=>x[1]===tf);if(idx<0)return;loadTf(tf,btn)});
    root.querySelectorAll('.indicator-toggles button[data-ind]').forEach(btn=>btn.onclick=()=>{
      const name=btn.dataset.ind,on=!btn.classList.contains('active');
      btn.classList.toggle('active',on);
      if(on&&['macd','rsi','kdj'].includes(name)){
        root.querySelectorAll('.indicator-toggles button[data-ind]').forEach(b=>{if(['macd','rsi','kdj'].includes(b.dataset.ind)&&b!==btn)b.classList.remove('active')});
      }
      if(chartInst)chartInst.setIndicator(name,on);
    });
    const activateTab=k=>{root.querySelectorAll('.gt-tabs [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===k));root.querySelectorAll('.gt-tab-body').forEach(d=>d.classList.toggle('active',d.dataset.body===k))};
    root.querySelectorAll('.gt-tabs [data-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
    const tradeJump=root.querySelector('#tradeJump');if(tradeJump)tradeJump.onclick=()=>{activateTab('trades');root.querySelector('[data-body="trades"]')?.scrollIntoView({behavior:'smooth',block:'start'})};
    root.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied';setTimeout(()=>{b.textContent='Copy'},1600)}catch{}});

    // ===== 4. K \u7ebf\u4f18\u5148：\u4efb\u52a1\u5b8c\u6210\u5373\u753b\u56fe + \u66f4\u65b0 RSI/MACD =====
    klineTask.then(({candles:k,sline})=>{
      if(!root.isConnected)return;
      candles=k;
      if(k.length){
        mountChart(k);
        const closes=k.map(x=>x.close),rv=rsi(closes).at(-1);
        const rsiEl=root.querySelector('#rsiVal');if(rsiEl)rsiEl.textContent=rv?.toFixed(2)||'—';
        const macdEl=root.querySelector('#macdVal');if(macdEl)macdEl.textContent=macd(closes).toFixed(4);
        if(rv!=null){
          const frs=root.querySelectorAll('.factor-row');
          if(frs[2]){const ts=Math.round(100-Math.abs(50-rv));frs[2].querySelector('strong').textContent=ts;const fb=frs[2].querySelector('b');if(fb)fb.style.width=ts+'%'}
        }
      }else{
        const ce=root.querySelector('#chartEmpty');
        if(ce)ce.innerHTML=`<b style="font-size:14px">None K \u7ebf\u6570\u636e</b><p style="opacity:.6;margin-top:6px;font-size:12px">\u884c\u60c5\u670d\u52a1\u6682\u672a\u8fd4\u56de\u6709\u6548\u8bb0\u5f55${isContract?'<br>On-Chain\u65b0Token\u53ef\u80fd\u9700\u8981\u79ef\u7d2f\u4e00\u5b9a\u4ea4\u6613\u91cf\u540e\u624d\u4f1a\u6709K\u7ebf\u6570\u636e<br><a href="${escapeHTML(dsUrl)}" target="_blank" style="color:#4f8cff">ViewExternal Market →</a>':'<br>CEX \u5e01\u79cd\u8bf7\u786e\u8ba4\u4ee3\u7801\u6b63\u786e'}</p>`;
      }
    }).catch(()=>{});
    // ===== 5. \u6570\u636e\u5757\u540e\u53f0\u5e76\u884c\u586b\u5145 =====
    const depthHtml=(pools)=>{
      if(!pools||!pools.length)return'<div class="cg-empty">None Pools\u6570\u636e</div>';
      const maxLiq=Math.max(...pools.map(p=>Number(p.liquidity)||0),1e-12);
      return pools.slice().sort((a,b)=>(Number(b.liquidity)||0)-(Number(a.liquidity)||0)).slice(0,6).map(p=>`<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><span style="min-width:44px;font-size:11px;opacity:.7">${escapeHTML(p.dex||'DEX')}</span><span style="min-width:76px;font-size:11px">${money(p.price)}</span><div style="flex:1;height:10px;background:rgba(128,128,128,.12);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round((Number(p.liquidity)||0)/maxLiq*100)}%;background:linear-gradient(90deg,#20d99a,#4f8cff)"></i></div><b style="min-width:76px;text-align:right;font-size:11px">${compact(p.liquidity)}</b></div>`).join('');
    };
    let poolsFilledByGmgn=false;
    const fillPools=(gmgnPools,pools)=>{
      const list=gmgnPools.length?gmgnPools:pools;
      const dh=depthHtml(list);
      const d1=root.querySelector('#depthTab');
      if(d1)d1.innerHTML=dh+`<p style="font-size:11px;opacity:.5;margin-top:8px">DEX \u4e3a AMM \u673a\u5236has no order book，\u6b64\u56fe\u5c55\u793a\u5404 PoolsLiquidity\u5206\u5e03（\u8fd1\u4f3cMarket Depth）</p>`;
      const d2=root.querySelector('#depthSide');
      if(d2)d2.innerHTML=dh+`<p style="font-size:11px;opacity:.5;margin-top:8px">AMM has no order book，\u4ee5\u5404 PoolsLiquidityShare\u8fd1\u4f3c\u6df1\u5ea6</p>`;
      const ph=root.querySelector('#poolsHead');
      if(ph)ph.textContent=`${list.length}  Pools · Aggregated Data`;
    };
    tradesTask.then(({trades:t,pools:p,tradeSource:s})=>{
      if(!root.isConnected)return;
      const tb=root.querySelector('#tradesBody');
      if(tb){
        const rows=t.slice(0,30).map(x=>{const side=String(x.side||x.type||x.kind||'').toLowerCase()==='buy'?'buy':'sell',wallet=x.wallet_address||x.wallet||x.from||'',tx=x.tx_hash||x.tx||'',amount=x.amount_usd??x.amount,tokenAmount=x.token_amount??x.amount_out;return `<tr><td>${timeStr(x.time||x.timestamp)}</td><td class="${side==='buy'?'up':'down'}">${side==='buy'?'Buy':'Sell'}</td><td><span title="${escapeHTML(wallet)}">${short(wallet)}</span></td><td>${amount==null?'—':money(amount)}</td><td>${tokenAmount==null?'—':compact(tokenAmount)}</td><td>${money(x.price_usd??x.price)}</td><td>${escapeHTML(x.dex||'—')}</td><td>${tx?`<a class="tx-link" href="${escapeHTML(exUrl)}/tx/${escapeHTML(tx)}" target="_blank" rel="noreferrer">View</a>`:'—'}</td></tr>`}).join('');
        tb.innerHTML=rows||`<tr><td colspan="8" class="cg-empty">${!isContract?'On-ChainTrades\u4ec5\u5bf9ContractToken\u53ef\u7528':`No Data<br><span style="opacity:.5;font-size:11px">\u6570\u636e\u670d\u52a1\u6682\u672a\u8fd4\u56de\u8be5Token\u7684Trades，\u8bf7\u7a0d\u540eRefresh</span>`}</td></tr>`;
      }
      const th=root.querySelector('#tradesHead');
      if(th)th.textContent=`${t.length}  Trades · \u5b9e\u65f6\u4ea4\u6613\u6570\u636e`;
      const jc=root.querySelector('#tradeJumpCount');if(jc)jc.textContent=t.length;
      if(!poolsFilledByGmgn&&p&&p.length)fillPools([],p);
    }).catch(()=>{});
    smTask.then(({smMatched,smSym,smSolCount,smTraders})=>{
      if(!root.isConnected)return;
      const slot=root.querySelector('#smSlot');
      if(!slot)return;
      const head=root.querySelector('#smHead');
      if(head)head.textContent=smMatched.length+' MATCHED · SMART MONEY';
      const timeAgo=t=>{if(!t)return'';const d=Math.max(0,(Date.now()/1000-t)/3600);return d<1?Math.round(d*60)+'m':d.toFixed(1)+'h'};
      let html='';
      if(smTraders&&smTraders.traders&&smTraders.traders.length){
        const rows=smTraders.traders.map((h,i)=>{const p=Number(h.profit)||0;const tag=h.smart?('<span class="sm-chip" style="background:rgba(199,146,234,.16);color:#c792ea">🧠 '+escapeHTML(h.smart_note||'Smart Money')+'</span>'):'';const nm=h.name?escapeHTML(String(h.name).slice(0,24)):short(h.address);return '<tr><td class="rank-id">'+(i+1)+'</td><td><span class="addr-cell" title="'+escapeHTML(h.address)+'">'+nm+'</span></td><td>'+tag+'</td><td class="'+(p>=0?'up':'down')+'">'+money(p)+'</td><td>'+money(h.buy_volume)+'</td><td>'+money(h.sell_volume)+'</td></tr>'}).join('');
        html+='<div class="panel" style="margin-bottom:12px"><div class="panel-head"><h2>REAL-TIME TOP TRADERS</h2><span>'+(smTraders.list_updated_at?(' '+timeAgo(smTraders.list_updated_at)+''):'')+'</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>#</th><th>TRADER</th><th>TAG</th><th>PROFIT</th><th>BUY</th><th>SELL</th></tr></thead><tbody>'+rows+'</tbody></table></div><p style="font-size:10px;opacity:.55;margin:6px 12px 10px">：（）· 🧠 = （）</p></div>';
      }else{
        html+='<div class="empty-page" style="padding:16px"><b> Top </b><p style="font-size:11px">（/），。</p></div>';
      }
      if(smMatched.length){
        const rows=smMatched.map(h=>{const dir=h.direction||(h.side==='buy'?'in':'out');const note=h.note||'Smart Money';return '<tr><td><span class="addr-cell" title="'+escapeHTML(h.address)+'">'+short(h.address)+'</span></td><td><span class="sm-chip">'+escapeHTML(note)+'</span></td><td class="'+(dir==='in'?'up':'down')+'">'+(dir==='in'?'In(Buy)':'Out(Sell)')+'</td><td class="warn">'+money(h.usd)+'</td></tr>'}).join('');
        html+='<div class="panel"><div class="panel-head"><h2>SMART MONEY LIST MATCH</h2><span>'+smMatched.length+' MATCHED · ON-CHAIN</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>WALLET</th><th>Note</th><th>Side</th><th>USD</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
      }
      slot.innerHTML=html||('<div class="empty-page" style="padding:20px"><b>TokenSmart Money</b><p>：Solana Smart Money '+smSolCount+'  +  EVM Smart Wallet。</p></div>');
    }).catch(()=>{});
    // Holders \u6a21\u5757\u5de5\u5177（GMGN \u4f18\u5148）
    const hPct=h=>h.percent!=null?Number(h.percent):(h.pct!=null?Number(h.pct)*100:null);
    const hNet=h=>{const n=Number(h.netflow_usd);return Number.isFinite(n)?n:null};
    const fmtAmt=n=>{if(n==null||!Number.isFinite(Number(n)))return'—';const v=Number(n);return v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(2)+'K':v.toLocaleString('en-US',{maximumFractionDigits:2})};
    const holderMetric=(k,v,cls='')=>`<div class="holder-metric"><span>${k}</span><b class="${cls}">${v}</b></div>`;
    const hTag=h=>{const t=[];if(h.smart)t.push(`<span class="h-tag smart" title="Smart Money：\u540d\u5355\u5339\u914d\u6216\u884c\u4e3a\u89c4\u5219（Net Flow+Buy\u4e3a\u4e3b）">🧠 ${escapeHTML(h.smart_note||'Smart Money')}</span>`);if(h.exchange)t.push(`<span class="h-tag exch" title="${escapeHTML(h.exchange)}">${escapeHTML(String(h.exchange).slice(0,10))}</span>`);if(h.is_new)t.push('<span class="h-tag new">NEW</span>');if(h.is_suspicious)t.push('<span class="h-tag sus">Suspicious</span>');const nf=hNet(h);if(nf!=null&&nf!==0)t.push(`<span class="h-tag ${nf>0?'up':'down'}">${nf>0?'Accumulating':'Reducing'}</span>`);return t.join('')};
    const holderRow=(h,i)=>`<tr data-haddr="${escapeHTML(h.address)}"><td class="h-rank">${i+1}</td><td class="h-addr-cell"><a class="h-addr" href="${escapeHTML(exUrl)}${addrPath}${encodeURIComponent(h.address)}" target="_blank" rel="noreferrer" title="${escapeHTML(h.address)}">${short(h.address)}</a><button class="h-copy" data-copy="${escapeHTML(h.address)}" title="Copy address">⧉</button></td><td class="h-amt">${fmtAmt(h.balance)}</td><td class="h-pct-cell"><div class="h-pct"><i style="width:${Math.min(100,hPct(h)||0)}%"></i></div><b>${hPct(h)!=null?hPct(h).toFixed(2)+'%':'—'}</b></td><td class="h-usd">${money(h.usd)}</td><td class="h-tags">${hTag(h)}<button class="h-tag-btn" data-smart-tag="${escapeHTML(h.address)}" data-smart-note="${escapeHTML(h.smart_note||'')}" title="\u4eba\u5de5\u6807\u8bb0Smart MoneyAddress">${h.smart?'Edit Label':'+ Smart Money'}</button></td></tr>`;
    const holdersEmpty='Collecting holders…<br><span style="opacity:.5;font-size:11px">On-ChainData is not cached yet，Automatic retry pending</span>';
    const fillHolders=(gmgnHolders,holderStats,gmgnSec)=>{
      if(!root.isConnected)return;
      const tb=root.querySelector('#holderBody');
      const src=gmgnHolders.slice(0,20);
      const hasStats=holderStats&&(holderStats.holders!=null||holderStats.top10_percent!=null);
      const hTop10=holderStats&&holderStats.top10_percent!=null?Number(holderStats.top10_percent):(gmgnSec&&gmgnSec.top_10_holder_rate!=null?Number(gmgnSec.top_10_holder_rate)*100:null);
      const hBundler=holderStats&&holderStats.bundler_holders!=null?Number(holderStats.bundler_holders):null;
      const hInfPct=holderStats&&holderStats.influencer_percent!=null?(Number(holderStats.influencer_percent)*100):null;
      const head=root.querySelector('#holdersHead');
      if(head)head.textContent=`TOP ${Math.min(20,src.length)} · On-Chain\u6570\u636e · 60S AUTO`;
      const extra=root.querySelector('#holderExtra');
      if(extra)extra.innerHTML=`${hTop10!=null?`TOP10 Concentration <b class="${hTop10>=30?'warn':''}">${hTop10.toFixed(2)}%</b>`:''}${hBundler!=null?` · Bundled Wallets <b>${hBundler.toLocaleString('en-US')}</b>`:''}${hInfPct!=null?` · Influencer Share <b>${hInfPct.toFixed(3)}%</b>`:''}`;
      if(tb&&src.length){
        tb.innerHTML=src.map(holderRow).join('');
        tb.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='✓';setTimeout(()=>{b.textContent='⧉'},1400)}catch{}});
        tb.querySelectorAll('[data-smart-tag]').forEach(b=>b.onclick=async()=>{
          const note=window.prompt('Enter a Smart Money label for this address',b.dataset.smartNote||'Manual Label');
          if(note===null||!note.trim())return;
          const old=b.textContent;b.disabled=true;b.textContent='Saving…';
          try{
            const r=await api.smartWalletTag(b.dataset.smartTag,chain,note.trim());
            if(!r?.ok)throw new Error(r?.message||'Save failed');
            const h=src.find(x=>x.address===b.dataset.smartTag);
            if(h){h.smart=true;h.smart_note=note.trim()}
            fillHolders(src,holderStats,gmgnSec);
          }catch(e){window.alert(e.message||'Failed to save label');b.disabled=false;b.textContent=old}
        });
        const qv=holderSearch?holderSearch.value.trim().toLowerCase():'';
        if(qv)tb.querySelectorAll('tr[data-haddr]').forEach(tr=>{tr.style.display=String(tr.dataset.haddr).toLowerCase().includes(qv)?'':'none'});
      }
      if(tb&&!src.length&&(hasStats||gmgnHolders.length===0)){
        tb.innerHTML=`<tr><td colspan="6" class="cg-empty">${holdersEmpty}</td></tr>`;
      }
      if(hasStats){
        const mtr=root.querySelector('#holderMetrics');
        if(mtr)mtr.innerHTML=[['Total Holders',holderStats.holders!=null?Number(holderStats.holders).toLocaleString('en-US'):'—'],
          ['TOP10 Share',holderStats.top10_percent!=null?Number(holderStats.top10_percent).toFixed(2)+'%':'—'],
          ['Smart MoneyShare',holderStats.smart_money_percent!=null?(Number(holderStats.smart_money_percent)*100).toFixed(2)+'%':'—'],
          ['New Wallets',holderStats.new_wallets!=null?Number(holderStats.new_wallets).toLocaleString('en-US'):'—']]
          .map(([k,v])=>holderMetric(k,v)).join('');
      }
    };
    const fillSec=(sec)=>{
      if(!sec||!root.isConnected)return;
      const secSlot=root.querySelector('#secSlot');
      if(!secSlot)return;
      const secRow=(k,v)=>{let txt='—',cls='';if(v===true||v===1||v==='1'){txt='Yes';cls='warn'}else if(v===false||v===0||v==='0'){txt='No';cls='ok'}else if(v!=null&&v!==''){txt=String(v)}return `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0"><span style="opacity:.6">${k}</span><b class="${cls}" style="font-weight:600">${txt}</b></div>`};
      secSlot.innerHTML=`<section class="panel"><div class="panel-head"><h2>Contract Security</h2><span>SECURITY DATA</span></div><div class="sec-grid" style="padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:12px">
        ${secRow('Honeypot', sec.is_honeypot)}
        ${secRow('Blacklist', sec.is_blacklist)}
        ${secRow('Ownership Renounced', sec.is_renounced)}
        ${secRow('Open Source', sec.is_open_source)}
        ${secRow('Buy\u7a0e', sec.buy_tax!=null?sec.buy_tax+'%':null)}
        ${secRow('Sell\u7a0e', sec.sell_tax!=null?sec.sell_tax+'%':null)}
        ${secRow('Top10 Concentration', sec.top_10_holder_rate!=null?(Number(sec.top_10_holder_rate)*100).toFixed(1)+'%':null)}
        ${secRow('Burn Ratio', sec.burn_ratio!=null?sec.burn_ratio+'%':null)}
      </div></section>`;
    };
    gmgnTask.then((g)=>{
      if(!root.isConnected)return;
      fillHolders(g.gmgnHolders,g.holderStats,g.gmgnSec);
      if(g.gmgnPools.length){poolsFilledByGmgn=true;fillPools(g.gmgnPools,[])}
      const slot=root.querySelector('#smSlot');
      if(slot&&g.gmgnSm.length){
        const rows=g.gmgnSm.map(h=>{const dir=h.direction||(h.side==='buy'?'in':'out');const note=h.note||'Smart Money';return `<tr><td><span class="addr-cell" title="${escapeHTML(h.address)}">${short(h.address)}</span></td><td><span class="sm-chip">${escapeHTML(note)}</span></td><td class="${dir==='in'?'up':'down'}">${dir==='in'?'In(Buy)':'Out(Sell)'}</td><td class="warn">${money(h.usd)}</td></tr>`}).join('');
        slot.innerHTML=`<div class="table-scroll"><table class="market-table"><thead><tr><th>WALLET</th><th>Note</th><th>Side</th><th>USD</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        const sh=root.querySelector('#smHead');
        if(sh)sh.textContent=`${g.gmgnSm.length} MATCHED · On-Chain\u6570\u636e`;
      }
      fillSec(g.gmgnSec);
    }).catch(()=>{});
    cnoteTask.then((cn)=>{
      if(!root.isConnected||!cn||!cn.note)return;
      const np=root.querySelector('#noteText');
      if(np)np.textContent=cn.note;
    }).catch(()=>{});
    // Holders \u4ea4\u4e92：Search + Refresh + 60s \u8f6e\u8be2
    const holderBody=root.querySelector('#holderBody');
    const holderSearch=root.querySelector('#holderSearch');
    if(holderBody&&holderSearch){
      holderSearch.oninput=()=>{
        const qv=holderSearch.value.trim().toLowerCase();
        holderBody.querySelectorAll('tr[data-haddr]').forEach(tr=>{tr.style.display=(!qv||String(tr.dataset.haddr).toLowerCase().includes(qv))?'':'none'});
      };
    }
    const refreshHolders=async()=>{
      if(!isContract||!root.isConnected)return;
      let hd=null,hs=null,gs=null;
      try{const gh=await api.gmgnHolders(chain,address,20).catch(()=>null);if(gh&&gh.ok&&asArray(gh.data).length)hd=asArray(gh.data)}catch{}
      try{const st=await api.holderStats(chain,address).catch(()=>null);if(st&&st.ok)hs=st}catch{}
      try{const gsec=await api.gmgnSecurity(chain,address).catch(()=>null);if(gsec&&gsec.ok)gs=gsec.data}catch{}
      if(!hd&&!hs&&!gs)return;
      fillHolders(hd||[],hs||null,gs||null);
      fillSec(gs);
    };
    const hrBtn=root.querySelector('#holderRefresh');
    if(hrBtn)hrBtn.onclick=()=>{const t=hrBtn.textContent;hrBtn.disabled=true;hrBtn.textContent='Refreshing…';refreshHolders().finally(()=>{hrBtn.disabled=false;hrBtn.textContent=t})};
    if(isContract)timer=setInterval(refreshHolders,60000);
    renderAIRail();
    // On-Chain\u6570\u636e\u81ea\u52a8\u8865\u5168：Large Transfers\u9996\u6b21\u672a\u547dMedium\u7f13\u5b58\u65f6，\u540e\u53f0 monitor \u9884\u70ed\u5b8c\u6210\u540e\u81ea\u52a8\u586b\u5145
    if(isContract&&isEvm&&(!transfers||!transfers.length)){
      let _tries=0;
      const _iv=setInterval(async()=>{
        _tries++;
        try{
          const _d=await api.tokenSnapshot(chain,address);
          const _tr=root.querySelector('[data-body="transfers"] tbody');
          const _ts=asArray(_d.transfers);
          if(_tr&&_ts.length){_tr.innerHTML=_ts.slice(0,8).map(e=>`<tr><td>${timeStr(e.time)}</td><td>${short(e.from)} → ${short(e.to)}</td><td>${Number(e.amount||0).toLocaleString('zh-CN',{maximumFractionDigits:4})}</td><td class="warn">${money(e.usd)}</td><td><a class="tx-link" href="${escapeHTML(exUrl)}/tx/${escapeHTML(e.tx)}" target="_blank" rel="noreferrer">View</a></td></tr>`).join('');clearInterval(_iv);return;}
        }catch(e){}
        if(_tries>=8)clearInterval(_iv);
      },8000);
    }
  }catch(e){
    const query = encodeURIComponent(isContract ? address : symbol);
    const cardHtml = collapseCard({
      title: 'Asset page failed',
      summary: e.message,
      error: e.message,
      retryLabel: 'Click to retry',
      dataSources: [
        { name: 'aicion',    desc: 'AICoin \u667a\u80fd\u884c\u60c5 / TokenSearch',                url: 'https://www.aicoin.com/search?key=' + query,        statusClass: 'error',   statusLabel: 'No match' },
        { name: 'cmc',       desc: 'CoinMarketCap Token Page / Search',                url: 'https://coinmarketcap.com/zh/search/?q=' + query,  statusClass: 'error',   statusLabel: 'Query failed' },
        { name: 'derivatives', desc: 'Derivatives / Perpetual Futures / Block Trades',   url: 'https://www.coinglass.com/zh/search?keyword=' + query, statusClass: 'loading', statusLabel: 'Available' }
      ],
      extraNote: '\u8be5\u8d44\u4ea7\u4e0d\u5728\u5185\u7f6e\u884c\u60c5\u5e93，\u53ef\u5728\u4e0a\u8ff0\u5e73\u53f0\u624b\u52a8SearchContract Address\u6216\u5e01\u79cdSymbolView\u8be6\u60c5'
    });
    root.innerHTML = cardHtml;
    const card = root.querySelector('.collapse-card');
    if (card) bindCollapse(root, { onRetry: () => renderToken(root, route) });
    renderAIRail();
  }
  return()=>{if(timer)clearInterval(timer);const cv3=root.querySelector('#tokenChart');if(cv3)disposeTradingChart(cv3)};
}
