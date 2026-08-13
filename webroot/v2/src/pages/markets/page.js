import {api} from '../../services/api.js';
import {money,compact,percent,escapeHTML} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {navigate} from '../../app/router.js';
import {asArray,asObject,safeJSON,isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, debounce, skeleton} from '../../utils/render.js';
import {openKlineModal,closeKlineModal} from '../../components/kline-modal.js';
import {FIXED_MARKET_IDS} from '../../data/market-token-assets.js';

// ===== \u6536\u85cf（Watch）：localStorage \u6301\u4e45\u5316，\u5b58\u6807\u51c6 Token \u5bf9\u8c61\u6570\u7ec4 =====
const FAV_KEY='aurum-markets-watch';
const CEX_FAV_KEY='quant-v2-watchlist';
const CHAIN_NAMES={bsc:'BSC',eth:'ETH',base:'BASE',arbitrum:'ARB',polygon:'POLYGON',solana:'SOL'};
const MAIN_CHAINS=['bsc','eth'];
const normChain=c=>String(c||'').toLowerCase().trim();
const getFav=()=>asArray(safeJSON(localStorage.getItem(FAV_KEY)||'[]',[])).map(asObject);
const saveFav=v=>{try{localStorage.setItem(FAV_KEY,JSON.stringify(asArray(v)))}catch{}};
const getWatchCex=()=>asArray(safeJSON(localStorage.getItem(CEX_FAV_KEY)||'[]',[])).map(value=>String(value||'')).filter(Boolean);
const saveWatchCex=v=>{try{localStorage.setItem(CEX_FAV_KEY,JSON.stringify(asArray(v)))}catch{}};
const inFav=(list,id)=>asArray(list).some(t=>t&&t.id===id);
const txFmt=b=>b==null?'—':Number(b).toLocaleString('en-US');
const ageFmt=t=>{if(!t)return'—';const h=Date.now()/1000-t;if(h<3600)return Math.max(1,Math.round(h/60))+'m';if(h<86400)return (h/3600).toFixed(1)+'h';return (h/86400).toFixed(1)+'d'};

// ===== \u6807\u51c6 Token \u5bf9\u8c61（\u8bbe\u8ba1\u6587\u6863 §1）=====
function normToken(p,source){
  p=p||{};
  const chain=normChain(p.chain);
  const id=String(p.token||p.symbol||'')+'-'+chain;
  return {
    id,
    chain,
    chainName:CHAIN_NAMES[chain]||String(chain).toUpperCase(),
    token:p.token||'',
    symbol:String(p.symbol||'?'),
    name:String(p.name||''),
    priceUsd:Number(p.price_usd??p.price??0),
    priceChange24h:p.price_change_24h??p.change_24h,
    liquidityUsd:Number(p.liquidity_usd??p.liquidity??0),
    volume24h:Number(p.volume_24h??p.volume24h??0),
    marketCap:Number(p.market_cap??p.marketCap??0),
    buys24h:p.buys_24h,
    sells24h:p.sells_24h,
    createdAt:p.created,
    riskScore:p.risk_score,
    riskLevel:p.risk_level,
    riskTags:asArray(p.risk_tags),
    hasKline:p.has_kline,
    url:p.url||'',
    source,
  };
}
const mergeById=(arr)=>{
  const seen=new Set(),out=[];
  asArray(arr).forEach(t=>{if(t&&t.id&&!seen.has(t.id)){seen.add(t.id);out.push(t)}});
  return out;
};
// Main List\u52a0\u8f7dStatus（\u6a21\u5757\u7ea7，\u4f9b\u7a7a\u6001\u6587\u6848/Status\u6761Total \u7528）
let mainState={status:'loading',msg:''};
const errKind=e=>{
  if(e&&(e.name==='AbortError'||e instanceof TypeError||/network|fetch|\u8d85\u65f6/i.test(String(e&&e.message||''))))return'network';
  return'error';
};

// ===== \u7ec8\u7aef\u5f0f\u7eb5\u5411\u5217\u8868 =====
const cardHtml=(t,fav)=>{
  const chg=Number(t.priceChange24h);
  const chgCls=chg>=0?'up':'down';
  const riskLabel=t.riskLevel?`${t.riskScore??''} ${t.riskLevel}`.trim():'—';
  const age=(t.created&&(Date.now()-Number(t.created))<86400000)?'<em class="mkt-new">NEW</em>':'';
  return `<div class="mkt-card mkt-list-row" data-id="${escapeHTML(t.id)}" data-chain="${escapeHTML(t.chain)}" data-token="${escapeHTML(t.token)}" data-sym="${escapeHTML(t.symbol)}">
    <div class="mkt-card-head mkt-token-cell">
      <div class="mkt-asset-name"><b>${escapeHTML(t.symbol)} ${age}</b><span title="${escapeHTML(t.name)}">${escapeHTML(t.name||'—')}</span></div>
      <span class="mkt-chain">${escapeHTML(t.chainName)}</span>
    </div>
    <div class="mkt-metrics">
      <div class="mkt-metric mkt-price"><span>Price</span><b>${money(t.priceUsd)}</b></div>
      <div class="mkt-metric mkt-chg ${chgCls}"><span>24H</span><b>${percent(t.priceChange24h)}</b></div>
      <div class="mkt-metric"><span>Market Cap</span><b>${compact(t.marketCap)}</b></div>
      <div class="mkt-metric"><span>Liquidity</span><b>${compact(t.liquidityUsd)}</b></div>
      <div class="mkt-metric"><span>24H Volume</span><b>${compact(t.volume24h)}</b></div>
      <div class="mkt-metric mkt-risk-cell"><span>Risk</span><b class="mkt-risk ${escapeHTML(t.riskLevel||'normal')}">${escapeHTML(riskLabel)}</b></div>
    </div>
    <button class="mkt-fav${fav?' on':''}" data-fav="${escapeHTML(t.id)}" title="${fav?'Remove from watchlist':'Add to watchlist'}" aria-label="${fav?'Remove from watchlist':'Add to watchlist'}">${fav?'★':'☆'}</button>
  </div>`;
};
const listHead='<div class="mkt-list-head"><span>TOKEN</span><span>PRICE</span><span>24H</span><span>MARKET CAP</span><span>LIQUIDITY</span><span>VOLUME 24H</span><span>RISK</span><span>WATCH</span></div>';
const sectionHtml=(title,sub,list,fav,emptyHtml)=>`<section class="mkt-section"><h3 class="mkt-section-title"><i class="bar"></i>${title}<span>${sub}</span></h3>${list.length?`<div class="mkt-list">${listHead}${list.map(t=>cardHtml(t,inFav(fav,t.id))).join('')}</div>`:`<div class="mkt-empty">${emptyHtml||`No ${escapeHTML(title)} data. Please refresh later.`}</div>`}</section>`;

// ===== CEX Reference Mode（\u539f\u903b\u8f91\u4fdd\u7559）=====
const cexRows=(coins,query='',watch=[])=>asArray(coins).filter(c=>(String(c?.symbol||'')+' '+String(c?.name||'')).toLowerCase().includes(query.toLowerCase())).map(c=>`<tr data-token="${escapeHTML(c.token||c.symbol)}" data-chain="${escapeHTML(c.chain||'')}"><td><div class="asset"><button class="fav" data-fav="${escapeHTML(c.symbol)}">${watch.includes(c.symbol)?'★':'☆'}</button><span class="asset-name"><b>${escapeHTML(c.name)}</b><span>${escapeHTML(c.symbol)} · #${c.rank}${c.chain?` · ${escapeHTML(c.chain)}`:''}</span></span></div></td><td>${money(c.price)}</td><td class="${Number(c.change_24h)>=0?'up':'down'}">${percent(c.change_24h)}</td><td>${compact(c.volume_24h)}</td><td>${compact(c.market_cap)}</td><td>${c.onchain?(c.liquidity_usd!=null?compact(c.liquidity_usd):'—'):compact(c.open_interest)}</td><td>${c.onchain?(c.pair_count!=null?c.pair_count+' Pools':'—'):(c.funding_rate==null?'—':(Number(c.funding_rate)*100).toFixed(4)+'%')}</td><td>${c.onchain?(c.event_count!=null?c.event_count+' Trades':'—'):(c.long_short_ratio?Number(c.long_short_ratio).toFixed(2):'—')}</td><td class="warn">${compact(c.liquidations_24h)}</td></tr>`).join('');

export async function renderMarkets(root){
  let mode='chain',view='main',lastQuery='',scanning=false;
  let mainList=[],searchList=[],all=[],watch=getFav(),cexCoins=[],liveTimer=null;
  let walletProtected=false,watchSyncReady=false,watchSyncPromise=Promise.resolve();
  root.innerHTML=skeleton({cards:0,panels:1,rows:8,cols:9});
  const snap={current:null};
  const q=s=>root.querySelector(s);

  const paintWatchProtection=()=>{
    const badge=q('#watchProtection');
    if(!badge)return;
    badge.classList.toggle('protected',walletProtected);
    badge.textContent=walletProtected?'Protected by wallet session':'Local only';
    badge.title=walletProtected?'Watchlist changes are saved to your verified wallet session.':'Verify your wallet to protect and sync this watchlist.';
  };
  const queueWatchlistSync=()=>{
    if(!watchSyncReady)return;
    watchSyncPromise=watchSyncPromise.catch(()=>{}).then(async()=>{
      const result=await api.userWatchlistSave({chain:getFav(),cex:getWatchCex()});
      if(!result?.ok)throw new Error('Watchlist sync failed');
      walletProtected=true;
      paintWatchProtection();
    }).catch(()=>{
      walletProtected=false;
      paintWatchProtection();
    });
  };
  try{
    const session=await api.walletSession();
    if(session?.ok&&(session?.authenticated||session?.verified)){
      const remote=await api.userWatchlist();
      if(remote?.ok){
        if(remote.has_data){
          watch=asArray(remote.chain).map(asObject);
          saveFav(watch);
          saveWatchCex(asArray(remote.cex));
        }else{
          const migrated=await api.userWatchlistSave({chain:getFav(),cex:getWatchCex()});
          if(!migrated?.ok)throw new Error('Watchlist migration failed');
        }
        watchSyncReady=true;
        walletProtected=true;
      }
    }
  }catch{
    // Local watchlists remain authoritative when wallet-session services are unavailable.
  }

  // ===== \u89c6\u56fe\u6e32\u67d3 =====
  const viewEl=()=>q('#marketView');
  const bindCards=()=>{
    const v=viewEl();if(!v)return;
    v.querySelectorAll('.mkt-card').forEach(card=>{
      card.onclick=e=>{
        if(e.target.closest('.mkt-fav'))return;
        const ch=card.dataset.chain,tk=card.dataset.token;
        const id=card.dataset.id;
        const t=[...all,...searchList,...watch].find(x=>x.id===id)||[...all,...searchList].find(x=>x.token===tk&&(!ch||x.chain===ch));
        openKlineModal(t||{chain:ch,token:tk,symbol:(card.dataset.sym||''),name:''});
      };
    });
    v.querySelectorAll('.mkt-fav').forEach(b=>{
      b.onclick=e=>{e.stopPropagation();
        const id=b.dataset.fav;
        let fav=getFav();
        if(inFav(fav,id))fav=fav.filter(t=>t&&t.id!==id);
        else{
          const t=[...all,...searchList].find(x=>x.id===id);
          if(t)fav=[...fav,{...t}];
        }
        watch=fav;saveFav(fav);queueWatchlistSync();updateFavCount();
        if(view==='fav')paintFav();
        else if(view==='search')paintSearch(lastQuery);
        else paintMain();
      };
    });
  };
  const paintMain=()=>{
    if(!isMounted(root)||view!=='main')return;
    const v=viewEl();if(!v)return;
    // \u56db Assets\u4ea7\u54c1\u5206\u533a：Mkt Cap TOP / Binance Alpha / Solana / ETH
    const top=mainList.filter(t=>t.marketCap>=100000000).slice(0,12);
    const alpha=mainList.filter(t=>t.source==='qualified').slice(0,40);
    const sol=mainList.filter(t=>['sol','solana'].includes(t.chain)).slice(0,40);
    const eth=mainList.filter(t=>t.chain==='eth').slice(0,40);
    const emptyHtml=()=>{
      if(mainState.status==='error')return`API load failed: ${escapeHTML(mainState.msg)}<br><span style="opacity:.75">Please retry later or switch to All Markets (CEX Reference).</span><br><button class="terminal-btn" id="emptyRetry" style="margin-top:12px">↻ Reload</button>`;
      if(mainState.status==='network')return`Network error: ${escapeHTML(mainState.msg)}<br><span style="opacity:.75">Check your network and try again.</span><br><button class="terminal-btn" id="emptyRetry" style="margin-top:12px">↻ Reload</button>`;
      return`No qualifying tokens. The list refreshes automatically in 30 seconds.<br><button class="terminal-btn" id="emptyRetry" style="margin-top:12px">↻ Refresh Now</button>`;
    };
    v.innerHTML=sectionHtml('Market Cap TOP','Market Cap ≥ $100M · '+top.length+' Assets'+(scanning?' · Updating':' '),top,watch,emptyHtml())
              +sectionHtml('Binance Alpha','Official Listings · '+alpha.length+' Assets',alpha,watch)
              +sectionHtml('Solana','SOL · '+sol.length+' Assets',sol,watch)
              +sectionHtml('ETH','Ethereum · '+eth.length+' Assets',eth,watch);
    bindCards();
    v.querySelectorAll('#emptyRetry').forEach(er=>er.onclick=()=>loadMain());
  };
  const paintSearch=(qstr)=>{
    if(!isMounted(root)||view!=='search')return;
    const v=viewEl();if(!v)return;
    const list=searchList;
    v.innerHTML=`<section class="mkt-section"><h3 class="mkt-section-title"><i class="bar"></i>Search Results: ${escapeHTML(qstr)}<span>All Chains · ${list.length} Assets</span></h3>${list.length?`<div class="mkt-list">${listHead}${list.map(t=>cardHtml(t,inFav(watch,t.id))).join('')}</div>`:`<div class="mkt-empty">No matching token. Try a symbol, name or contract address.</div>`}</section>`;
    bindCards();
  };
  const paintFav=()=>{
    if(!isMounted(root)||view!=='fav')return;
    const v=viewEl();if(!v)return;
    const list=watch;
    v.innerHTML=`<section class="mkt-section"><h3 class="mkt-section-title"><i class="bar"></i>Watchlist<span>${list.length} Assets · ${walletProtected?'Protected by wallet session':'Saved locally'}</span></h3>${list.length?`<div class="mkt-list">${listHead}${list.map(t=>cardHtml(t,true)).join('')}</div>`:`<div class="mkt-empty">Your watchlist is empty. Click ☆ in the market list or search results to add an asset.</div>`}</section>`;
    bindCards();
  };
  const updateFavCount=()=>{const c=q('#favCount');if(c)c.textContent=getFav().length};

  // ===== \u6570\u636e\u52a0\u8f7d（Status\u673a：loading / ok / empty / error / network）=====
  const stampTxt=()=>{
    const st=q('#marketStamp');if(!st)return;
    if(mainState.status==='loading')st.innerHTML='<span style="opacity:.8">● Loading...</span>';
    else if(mainState.status==='error')st.innerHTML='<span style="color:var(--red)">⚠ API Error · <a href="#" id="stampRetry" style="color:inherit;text-decoration:underline">Retry</a></span>';
    else if(mainState.status==='network')st.innerHTML='<span style="color:var(--warning)">⚠ Network Error · <a href="#" id="stampRetry" style="color:inherit;text-decoration:underline">Retry</a></span>';
    else st.textContent='● Tracked Assets · Updated '+new Date().toLocaleTimeString('en-US',{hour12:false})+' · '+mainList.length;
    const r=q('#stampRetry');if(r)r.onclick=e=>{e.preventDefault();loadMain()};
  };
  const loadMain=async()=>{
    mainState={status:'loading',msg:''};stampTxt();
    try{
      // \u4e3b\u6570\u636e\u6e90：Tracked Assets（Mkt Cap\u5927 + GMGN K \u7ebf\u6821\u9a8c\u901a\u8fc7）；watchboard/radar \u515c\u5e95\u8865\u5145
      const [qf,wb,rd]=await Promise.allSettled([api.marketsQualified(),api.watchboard(),api.radarProjects('liquidity','','')]);
      let arr=[];
      if(qf.status==='fulfilled'){
        arr=arr.concat(asArray(qf.value.coins).filter(c=>c&&c.chain!=='market').map(c=>normToken(c,'qualified')));
        scanning=!!qf.value.scanning;
      }
      if(wb.status==='fulfilled')arr=arr.concat(asArray(wb.value.coins).filter(c=>c&&c.onchain).map(c=>normToken(c,'watchboard')));
      if(rd.status==='fulfilled')arr=arr.concat(asArray(rd.value.projects).map(p=>normToken(p,'radar')));
      all=mergeById(arr).filter(t=>FIXED_MARKET_IDS.has(t.id));
      // \u53ef\u6355\u6349\u4f18\u5148（has_kline=true），\u5176\u4f59\u515c\u5e95；\u6309Mkt Cap\u964d\u5e8f
      mainList=all.filter(t=>t.chain!=='market'&&t.chain)
        .sort((a,b)=>(b.marketCap||0)-(a.marketCap||0)||(b.hasKline?1:0)-(a.hasKline?1:0));
      // \u7528\u6700\u65b0\u6570\u636eRefreshWatch\u5feb\u7167（Price/Liquidity\u4fdd\u6301\u65b0\u9c9c）
      const byId={};all.forEach(t=>byId[t.id]=t);
      watch=watch.map(t=>byId[t.id]?{...t,...byId[t.id]}:t);
      saveFav(watch);
      if(!mainList.length){
        const anyFail=qf.status==='rejected'||wb.status==='rejected'||rd.status==='rejected';
        if(anyFail){
          const msgs=[qf.status==='rejected'?('Qualified list '+(qf.reason&&qf.reason.message||'load failed')):null,
                      wb.status==='rejected'?('Watchboard '+(wb.reason&&wb.reason.message||'load failed')):null,
                      rd.status==='rejected'?('Radar '+(rd.reason&&rd.reason.message||'load failed')):null].filter(Boolean);
          mainState={status:msgs.some(m=>/network|timeout|fetch/i.test(m))?'network':'error',msg:msgs.join('; ')};
        }else{
          mainState={status:'empty',msg:'All data sources returned no data'};
        }
      }else{
        mainState={status:'ok',msg:''};
      }
      stampTxt();
      if(view==='main')paintMain();
    }catch(e){
      mainState={status:errKind(e),msg:e&&e.message||String(e)};
      stampTxt();
      if(view==='main')paintMain();
    }
  };
  const doSearch=async(qstr)=>{
    const paint=()=>paintSearch(qstr);
    try{
      const [rd,wb,qf]=await Promise.allSettled([api.radarProjects('liquidity','',qstr),api.watchboard(),api.marketsQualified()]);
      let arr=[];
      if(rd.status==='fulfilled')arr=arr.concat(asArray(rd.value.projects).map(p=>normToken(p,'radar')));
      if(qf.status==='fulfilled')arr=arr.concat(asArray(qf.value.coins).filter(c=>c&&c.chain!=='market'&&((String(c.symbol||'').toLowerCase().includes(qstr))||(String(c.name||'').toLowerCase().includes(qstr)))).map(c=>normToken(c,'qualified')));
      if(wb.status==='fulfilled')arr=arr.concat(asArray(wb.value.coins).filter(c=>c&&c.onchain&&((String(c.symbol||'').toLowerCase().includes(qstr))||(String(c.name||'').toLowerCase().includes(qstr)))).map(c=>normToken(c,'watchboard')));
      searchList=mergeById(arr).sort((a,b)=>(b.marketCap||0)-(a.marketCap||0));
      paint();
    }catch{paint()}
  };
  // CEX Mode
  const paintCex=()=>{
    if(!isMounted(root))return;
    const body=q('#marketRows'),search=q('#marketSearch');
    if(!body||!search)return;
    const html=cexRows(cexCoins,search.value,getWatchCex());
    if(unchanged(snap,html))return;
    snap.current=snapshot(html);
    withScroll(root,'.table-scroll',()=>{body.innerHTML=html});
    root.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{let a=getWatchCex(),s=b.dataset.fav;a=a.includes(s)?a.filter(x=>x!==s):[...a,s];saveWatchCex(a);queueWatchlistSync();paintCex()});
    root.querySelectorAll('#marketRows tr[data-token]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('.fav')||e.target.closest('.ct-del'))return;const t=tr.dataset.token,ch=tr.dataset.chain;const c=cexCoins.find(x=>String(x.token||x.symbol)===t);openKlineModal(c?{...c,chain:ch||c.chain||'market',token:c.token||'',symbol:c.symbol||t,name:c.name||''}:{chain:ch||'market',token:t,symbol:t,name:t})});
  };
  const loadCex=async()=>{
    try{
      cexCoins=asArray((await api.marketTop())?.coins);
      if(!isMounted(root))return;
      paintCex();
      const stamp=q('#marketStamp');if(stamp)stamp.textContent='CEX REFERENCE · '+new Date().toLocaleTimeString('en-US',{hour12:false});
    }catch{}
  };
  const overlayLive=async()=>{
    try{
      const res=await api.priceLive(cexCoins.map(c=>c.token||c.symbol).filter(Boolean));
      const map=(res&&res.prices)||{};if(!map||!Object.keys(map).length)return;
      const body=q('#marketRows');if(!body)return;
      body.querySelectorAll('tr[data-token]').forEach(tr=>{const p=map[tr.getAttribute('data-token')]||map[(tr.getAttribute('data-token')||'').toLowerCase()];if(!p)return;const td=tr.children;
        if(td[1])td[1].textContent=money(p.price);
        if(td[2]){td[2].textContent=percent(p.change_24h);td[2].className=(Number(p.change_24h)>=0?'up':'down');}
        if(td[3])td[3].textContent=compact(p.volume_24h);});
    }catch{}
  };
  // ===== \u9759\u6001\u7ed1\u5b9a =====
  const bindCexStatic=()=>{
    const ctWrap=q('#ctFormWrap'),ctToggle=q('#ctToggle');
    if(ctWrap&&ctToggle){ctToggle.onclick=()=>{const show=ctWrap.style.display==='none';ctWrap.style.display=show?'block':'none';if(show)q('#ctAddr')?.focus()};const ctForm=q('#ctForm');if(ctForm)ctForm.onsubmit=async e=>{e.preventDefault();const token=q('#ctAddr').value.trim(),chain=q('#ctChain').value,note=q('#ctNote').value.trim();if(!/^0x[a-fA-F0-9]{40}$/.test(token)){q('#ctAddr').focus();return}const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const out=await api.customTokenAdd(token,chain,note);if(!out.ok)throw new Error(out.message||'Add failed');q('#ctAddr').value='';q('#ctNote').value='';snap.current=null;await loadCex()}catch(err){alert(err.message)}finally{btn.disabled=false}};}
    root.querySelectorAll('[data-ct-del]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm('Remove this token from the market?'))return;try{await api.customTokenDelete(b.dataset.ctDel,b.dataset.ctChain);snap.current=null;loadCex()}catch(err){alert(err.message)}});
  };

  // =====  Page\u9762\u9aa8\u67b6 =====
  root.innerHTML=`<style id="mkStyle">
.mkt-view{padding:16px 16px 8px}
.mkt-section{margin-bottom:22px}
.mkt-section-title{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:15px;font-weight:700;letter-spacing:.05em;color:var(--text)}
.mkt-section-title .bar{width:4px;height:16px;border-radius:2px;background:var(--brand);box-shadow:0 0 8px rgba(8,231,247,.5)}
.mkt-section-title span{margin-left:auto;font:600 11px monospace;color:var(--muted);letter-spacing:.05em}
.mkt-list{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,rgba(20,27,40,.98),rgba(12,17,26,.98))}
.mkt-list-head,.mkt-list-row{display:grid;grid-template-columns:minmax(155px,1.7fr) minmax(78px,.9fr) 58px repeat(3,minmax(72px,.8fr)) 66px 36px;align-items:center;gap:6px}
.mkt-list-head{min-height:38px;padding:0 12px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.025);color:var(--muted);font:700 9px/1.2 monospace;letter-spacing:.04em}
.mkt-list-head span:not(:first-child){text-align:right}
.mkt-card{position:relative;min-width:0;min-height:68px;padding:10px 12px;border-bottom:1px solid var(--line-soft);cursor:pointer;transition:.16s}
.mkt-card:last-child{border-bottom:0}
.mkt-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand);opacity:0;transition:.16s}
.mkt-card:hover{background:rgba(8,231,247,.055)}
.mkt-card:hover::before{opacity:.85}
.mkt-card-head{display:flex;align-items:center;gap:8px;min-width:0}
.mkt-asset-name{min-width:0;flex:1}
.mkt-asset-name b{display:block;font:700 15px sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mkt-asset-name span{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mkt-new{display:inline-block;margin-left:5px;padding:1px 6px;border-radius:5px;background:rgba(8,231,247,.16);color:var(--brand);font:700 9px monospace;vertical-align:middle}
.mkt-chain{flex:0 0 auto;padding:3px 8px;border-radius:6px;background:var(--brand-soft);color:var(--brand);font:700 10px monospace;letter-spacing:.04em}
.mkt-fav{width:40px;height:40px;border:0;background:none;padding:0;font-size:20px;line-height:1;color:var(--muted);cursor:pointer;transition:.15s}
.mkt-fav:hover{color:var(--warning)}
.mkt-fav.on{color:#f4b728;text-shadow:0 0 10px rgba(244,183,40,.45)}
.mkt-metrics{display:contents}
.mkt-metric{min-width:0;text-align:right}
.mkt-metric>span{display:none;color:var(--muted);font-size:10px}
.mkt-metric>b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 11px/1.35 monospace;font-variant-numeric:tabular-nums}
.mkt-chg.up b{color:var(--green)}
.mkt-chg.down b{color:var(--red)}
.mkt-risk{display:inline-block;padding:3px 7px;border-radius:6px;font:700 10px monospace}
.mkt-risk.danger{background:rgba(255,95,109,.18);color:#ff5f6d}
.mkt-risk.high{background:rgba(255,159,67,.15);color:#ff9f43}
.mkt-risk.watch{background:rgba(244,183,40,.15);color:#f4b728}
.mkt-risk.normal{background:rgba(32,217,154,.14);color:#20d99a}
.mkt-empty{padding:38px 20px;text-align:center;color:var(--muted);font-size:14px;border:1px dashed var(--line);border-radius:12px;line-height:1.7}
.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.toolbar .terminal-input{flex:1 1 260px;min-width:200px}
.fav-count{min-width:22px;display:inline-grid;place-items:center;border-radius:10px;background:var(--surface-3);font:700 11px monospace;padding:2px 6px;margin-left:4px}
.watch-protection{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border:1px solid var(--line);border-radius:7px;color:var(--muted);font:700 9px/1 monospace;letter-spacing:.04em;white-space:nowrap}
.watch-protection::before{content:"";width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--muted)}
.watch-protection.protected{color:var(--green);border-color:rgba(14,203,129,.3);background:rgba(14,203,129,.06)}
.watch-protection.protected::before{background:var(--green);box-shadow:0 0 7px rgba(14,203,129,.45)}
.terminal-btn.active-fav{color:#07101f;background:var(--warning);border-color:var(--warning)}
@media(max-width:1100px){.mkt-list-head,.mkt-list-row{grid-template-columns:minmax(190px,1.8fr) repeat(5,minmax(84px,1fr)) 44px}.mkt-list-head span:nth-child(7),.mkt-risk-cell{display:none}}
@media(max-width:820px){.mkt-view{min-width:0;padding:12px 0 4px}.mkt-section-title{align-items:flex-start;flex-wrap:wrap}.mkt-section-title span{width:100%;margin-left:13px}.mkt-list{border-radius:10px}.mkt-list-head{display:none}.mkt-list-row{grid-template-columns:minmax(0,1fr) 40px;gap:10px;padding:14px}.mkt-token-cell{grid-column:1}.mkt-list-row>.mkt-fav{grid-column:2;grid-row:1;align-self:start}.mkt-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-column:1/-1;gap:0 18px;border-top:1px solid var(--line-soft)}.mkt-metric{display:flex;justify-content:space-between;gap:8px;text-align:left;padding-top:9px}.mkt-metric>span{display:block}.mkt-metric>b{text-align:right}.mkt-risk-cell{display:flex}.mkt-chain{margin-left:auto}.mkt-card:hover{background:transparent}}
</style>
<div class="page-head"><div><h1>Markets</h1><p>MARKET TOP · BINANCE ALPHA · SOLANA · ETH · AI RISK SCAN</p></div><div class="page-actions"><span class="status-live" id="marketStamp">● MARKET LIST · LIVE</span></div></div>
<div class="toolbar">
  <button id="modeChain" class="terminal-btn primary">⛓ ON-CHAIN LIST</button>
  <button id="modeCex" class="terminal-btn">🏛 ALL MARKETS (CEX REFERENCE)</button>
  <input id="marketSearch" class="terminal-input" placeholder="Search by symbol, name or contract address..." autocomplete="off">
  <button id="favToggle" class="terminal-btn" title="View watchlist">☆ WATCHLIST<span class="fav-count" id="favCount">0</span></button>
  <span class="watch-protection" id="watchProtection">Local only</span>
  <button id="refreshBtn" class="terminal-btn" title="Refresh data">REFRESH</button>
</div>
<div id="ctFormWrap" style="display:none;margin:10px 0"><form id="ctForm" class="wallet-form"><input id="ctAddr" class="terminal-input wallet-input" placeholder="Contract address 0x... (40 hexadecimal characters)" spellcheck="false"><select id="ctChain" class="terminal-select"><option value="bsc">BSC</option><option value="eth">Ethereum</option><option value="base">Base</option><option value="arbitrum">Arbitrum</option><option value="polygon">Polygon</option></select><input id="ctNote" class="terminal-input wallet-input" style="flex:.6" placeholder="Note (optional)" maxlength="80"><button class="terminal-btn primary">ADD TOKEN</button></form><p class="form-help">Added tokens appear in All Markets and On-Chain Monitor.</p></div>
<section class="panel"><div class="panel-head"><h2 id="matrixTitle">MARKET TERMINAL</h2><span id="matrixSub">VERTICAL LIST · LIVE MARKET DATA</span></div><div id="marketView" class="mkt-view"><div class="mkt-empty">Loading market data...</div></div><div id="cexWrap" style="display:none"><div class="table-scroll"><table class="market-table pro-table no-click" id="marketTable"><thead id="marketHead"><tr><th>TOKEN</th><th>PRICE</th><th>24H %</th><th>VOLUME</th><th>MARKET CAP</th><th>OPEN INTEREST</th><th>FUNDING</th><th>LONG/SHORT</th><th>LIQUIDATION</th></tr></thead><tbody id="marketRows"><tr><td colspan="9" class="cg-empty">Loading...</td></tr></tbody></table></div></div></section>`;

  // ===== \u4ea4\u4e92 =====
  const modeChain=q('#modeChain'),modeCex=q('#modeCex'),searchInput=q('#marketSearch'),favToggle=q('#favToggle'),refreshBtn=q('#refreshBtn');
  const setView=v=>{
    view=v;
    favToggle.classList.toggle('active-fav',v==='fav');
    favToggle.innerHTML=v==='fav'?'★ WATCHLIST<span class="fav-count" id="favCount">'+getFav().length+'</span>':'☆ WATCHLIST<span class="fav-count" id="favCount">'+getFav().length+'</span>';
    if(v==='main')paintMain();
    else if(v==='fav')paintFav();
  };
  const setMode=m=>{
    mode=m;
    modeChain.classList.toggle('primary',m==='chain');
    modeCex.classList.toggle('primary',m==='cex');
    const vw=q('#marketView'),cw=q('#cexWrap'),mt=q('#matrixTitle'),ms=q('#matrixSub'),st=q('#marketStamp'),ctWrap=q('#ctFormWrap');
    if(m==='chain'){
      vw.style.display='';cw.style.display='none';
      mt.textContent='MARKET TERMINAL';ms.textContent='VERTICAL LIST · LIVE MARKET DATA';
      st.textContent='● MARKET LIST · LIVE';
      if(ctWrap)ctWrap.style.display='none';
      clearInterval(liveTimer);liveTimer=null;
      if(view!=='main'){view='main';favToggle.classList.remove('active-fav');favToggle.innerHTML='☆ WATCHLIST<span class="fav-count" id="favCount">'+getFav().length+'</span>'}
      const si=q('#marketSearch');if(si&&si.value){si.value='';lastQuery=''}
      paintMain();
    }else{
      vw.style.display='none';cw.style.display='';
      mt.textContent='CEX REFERENCE TABLE';ms.textContent='Market and derivatives data reference';
      st.textContent='● CEX REFERENCE MODE';
      if(ctWrap)ctWrap.style.display='none';
      loadCex();
      if(liveTimer)clearInterval(liveTimer);
      liveTimer=setInterval(overlayLive,2000);
    }
  };
  modeChain.onclick=()=>setMode('chain');
  modeCex.onclick=()=>setMode('cex');
  favToggle.onclick=()=>setView(view==='fav'?'main':'fav');
  refreshBtn.onclick=()=>{const b=refreshBtn;b.disabled=true;b.textContent='REFRESHING...';const p=mode==='cex'?loadCex():loadMain();Promise.resolve(p).finally(()=>{b.disabled=false;b.textContent='REFRESH'})};
  searchInput.oninput=debounce(e=>{
    const qv=e.target.value.trim().toLowerCase();
    lastQuery=qv;
    if(mode==='cex'){paintCex()}
    else if(qv){if(view!=='search'){view='search';favToggle.classList.remove('active-fav')}doSearch(qv)}
    else{setView('main')}
  },250);
  bindCexStatic();
  paintWatchProtection();
  updateFavCount();
  await loadMain();
  const timer=setInterval(()=>{if(mode==='cex')loadCex();else loadMain()},30000);
  renderAIRail();
  return()=>{clearInterval(timer);if(liveTimer)clearInterval(liveTimer);closeKlineModal()};
}
