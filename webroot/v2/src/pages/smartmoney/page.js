// Smart Money（\u5408\u5e76\u5355 Page\u7248 2026-08-09）：\u539f smartmoney（\u4ea4\u6613\u6d41/Solana Smart Money\u5e93）+ \u539f wallet（\u81ea\u5b9a\u4e49Smart Wallet\u76d1\u63a7）
// \u4e0d\u5206\u7c7b、\u4e0d Tab，All\u677f\u5757\u6309\u987a\u5e8f\u5c55\u793a\u5728\u4e00 Assets Page\u9762；30s \u81ea\u52a8Refresh
import {api} from '../../services/api.js';
import {money,compact,escapeHTML,time,noteHtml} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, skeleton} from '../../utils/render.js';

const short=a=>a?`${String(a).slice(0,6)}…${String(a).slice(-4)}`:'—';
const timeStr=t=>{if(!t)return'—';const d=new Date(t*1000);return`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`};
const CHAINS=[['bsc','BSC'],['eth','Ethereum'],['base','Base'],['arbitrum','Arbitrum'],['polygon','Polygon']];

export async function renderSmartMoney(root){
  const snap={current:null};
  let timer;
  let tab='wallets';
  // \u4ea4\u6613\u6d41Status
  let stats=null,wallets=[],signals=[],q='',filter='All',error='';
  // Smart WalletStatus
  let swWallets=[],stream=[],swStats={},swError='',page=1;
  root.innerHTML=skeleton({cards:0,panels:2,rows:5,cols:8});
  const paint=async()=>{
    if(!isMounted(root))return;
    const [stRaw,listRaw,sigRaw,swRaw]=await Promise.all([
      api.smartMoneyStats().catch(()=>({})),
      api.smartMoneySol(200).catch(()=>({})),
      api.followSignals(100).catch(()=>({})),
      api.smartMoney(60).catch(()=>({})),
    ]);
    if(!isMounted(root))return;
    try{stats=asObject(stRaw.stats);wallets=asArray(listRaw.wallets||[]);signals=asArray(sigRaw.signals||[]);error='';}catch(e){error=e.message;stats=stats||{}}
    try{const out=asObject(swRaw);if(!out.ok)throw new Error(out.error||'Load failed');swWallets=asArray(out.wallets);stream=asArray(out.stream);swStats=asObject(out.stats);swError='';}catch(e){swError=e.message}
    if(!isMounted(root))return;
    const cats=asArray(stats.categories);
    const ql=q.toLowerCase();
    const shownWallets=ql?wallets.filter(w=>(w.address||'').toLowerCase().includes(ql)||(w.label_en||'').toLowerCase().includes(ql)||(w.label_zh||'').includes(ql)):wallets;
    // \u4ea4\u6613\u6d41\u7b5b\u9009（\u4e00\u4ee3\u540c\u6b3e：All/Buy/Sell/SmartWallet）
    let shown=signals;
    if(filter==='Buy')shown=shown.filter(s=>s.side==='buy');
    else if(filter==='Sell')shown=shown.filter(s=>s.side==='sell');
    if(ql)shown=shown.filter(s=>(s.wallet||'').toLowerCase().includes(ql)||(s.symbol||'').toLowerCase().includes(ql)||(s.wallet_note||'').toLowerCase().includes(ql));
    const smartNum=signals.length;
    const totalIn=wallets.length;
    // Smart Wallet\u677f\u5757：\u6392\u5e8f（X Chain\u63a5 → \u6709Note → NoneNote）+ \u5206 Page 20
    const tier=w=>/x\.com/.test(w.note||'')?0:(((w.note||'').trim())?1:2);
    const swSorted=swWallets.map((w,i)=>({w,i})).sort((a,b)=>tier(a.w)-tier(b.w)||a.i-b.i).map(x=>x.w);
    const n=swWallets.length;
    const PAGE=20,pages=Math.max(1,Math.ceil(swSorted.length/PAGE));
    if(page>pages)page=pages;
    const wl=swSorted.slice((page-1)*PAGE,page*PAGE);
    const pager=`<div style="display:flex;align-items:center;gap:10px;margin:10px 2px 2px"><button class="terminal-btn" data-page="prev" style="padding:4px 14px;font-size:12px" ${page<=1?'disabled':''}>← Previous</button><span style="font-size:12px;opacity:.7">Page  ${page} / ${pages}  Page · Total  ${n}  Assets</span><button class="terminal-btn" data-page="next" style="padding:4px 14px;font-size:12px" ${page>=pages?'disabled':''}>Next →</button></div>`;
    const swErrHtml=swError?`<div class="empty-page"><b>Load failed</b><p>${escapeHTML(swError)}</p></div>`:'';
    const walletListSection=!swError&&n?`<section class="panel"><div class="panel-head"><h2>SMART WALLET LIST</h2><span>${wl.length} / ${n} · PAGE ${page}/${pages}</span></div>${pager}<div class="table-scroll"><table class="market-table"><thead><tr><th>WALLET</th><th>CHAIN</th><th>Note</th><th>Events</th><th>In(6H)</th><th>Out(6H)</th><th>Net</th><th>Last Activity</th><th></th></tr></thead><tbody>${wl.map(w=>`<tr><td><div class="asset"><span class="coin-icon">${escapeHTML((w.note||w.address).slice(0,2).toUpperCase())}</span><span class="asset-name"><b>${short(w.address)}</b><span>${escapeHTML(w.address)}</span></span></div></td><td><span class="ex-badge">${escapeHTML(w.chain_name||w.chain)}</span></td><td>${noteHtml(w.note)}</td><td>${w.event_count}</td><td class="up">${money(w.total_in_usd)}</td><td class="down">${money(w.total_out_usd)}</td><td class="${(w.net_usd||0)>=0?'up':'down'}">${money(w.net_usd)}</td><td>${w.last_event?time(w.last_event.time):'—'}</td><td><button class="terminal-btn sw-del" data-del="${escapeHTML(w.address)}">Delete</button></td></tr>`).join('')||`<tr><td colspan="9" class="cg-empty">NoneWallet</td></tr>`}</tbody></table></div></section>`:(swErrHtml||`<div class="empty-page"><b>No smart wallets</b><p>add your first smart wallet above，to start tracking smart money。</p></div>`);
    const flowSection=`<section class="panel"><div class="panel-head"><h2>SMART MONEY FLOW</h2><span>${stream.length} EVENTS</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>TIME</th><th>TOKEN</th><th>SMART WALLET</th><th>Side</th><th>COUNTERPARTY</th><th>AMOUNT</th><th>USD</th><th>FLAG</th></tr></thead><tbody>${stream.map(e=>{const isIn=(e.to||'').toLowerCase()===(e.wallet||'').toLowerCase();const other=isIn?e.from:e.to;const exName=e.to_exchange;const wn=noteHtml(e.wallet_note);return`<tr><td>${time(e.time)}</td><td><b>${escapeHTML(e.symbol)}</b></td><td><span class="addr-cell">${wn==='—'?escapeHTML(short(e.wallet)):wn}</span></td><td class="${isIn?'up':'down'}">${isIn?'In':'Out'}</td><td>${short(other)}</td><td>${Number(e.amount||0).toLocaleString('en-US',{maximumFractionDigits:4})}</td><td class="warn">${money(e.usd)}</td><td>${exName?`<span class="ex-badge">${escapeHTML(exName)}</span>`:'<span class="cg-empty">—</span>'}</td></tr>`}).join('')||'<tr><td colspan="8" class="cg-empty">no large transfers in 6h</td></tr>'}</tbody></table></div></section>`;

    const navTab=(k,label,badge)=>`<button class="sm-nav ${tab===k?'active':''}" data-tab="${k}" type="button">${label}${badge?` <span style="opacity:.5;font-size:11px">(${badge})</span>`:''}</button>`;
    const tabBar=`<div class="sm-navbar">${navTab('wallets','Wallets & Library',n)}${navTab('trades','Trade Flow',shown.length)}</div>`;
    const heroForm=`<div class="wallet-hero"><form id="swForm" class="wallet-form"><input id="swAddr" class="terminal-input wallet-input" placeholder="Enter 0x smart wallet address…" spellcheck="false"><select id="swChain" class="terminal-select">${CHAINS.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('')}</select><input id="swNote" class="terminal-input wallet-input" style="flex:.6" placeholder="Note（Optional）" maxlength="80"><button class="terminal-btn primary">Add</button></form><p class="form-help">after adding a smart wallet，auto-monitor 6h on-chain transfers（≥$1,000），track smart money。</p></div>`;
    const metrics=`<div class="overview-grid">${[
      ['Smart Wallet',`<b>${n}</b>`,'smart wallets tracked'],
      ['On-Chain Events',`<b>${swStats.events??0}</b>`,'≥ $1,000 transfers'],
      ['Total In(6H)',`<b class="up">${money(swStats.total_in_usd)}</b>`,'inbound USD'],
      ['Net Flow(6H)',`<b class="${(swStats.net_usd||0)>=0?'up':'down'}">${money(swStats.net_usd)}</b>`,'in − out'],
    ].map(x=>`<article class="metric-card"><div class="metric-label">${x[0]}</div><div class="metric-value">${x[1]}</div><div class="metric-sub">${x[2]}</div></article>`).join('')}</div>`;
    const filterBar=`<div class="wallet-hero" style="margin-top:14px"><div class="sm-filter-row"><div class="sm-tabs">${[['All','ALL'],['Buy','BUY'],['Sell','SELL'],['SmartWallet','SMART WALLET('+smartNum+')']].map(([k,label])=>`<div class="sm-tab ${filter===k?'active':''}" data-f="${k}">${label}</div>`).join('')}</div><div class="sm-search-box"><input id="smSearch" class="terminal-input wallet-input" placeholder="Search address / token / note…" value="${escapeHTML(q)}" spellcheck="false"><button class="terminal-btn primary" id="smSearchBtn">Search</button></div></div></div>`;
    const tradesTab=`${filterBar}
    <section class="panel"><div class="table-scroll"><table class="market-table"><thead><tr><th>TIME</th><th>SIDE</th><th>TOKEN</th><th>PRICE</th><th>AMOUNT</th><th>USD</th><th>SMART WALLET</th><th>TX</th></tr></thead><tbody>${shown.map(s=>`<tr><td>${timeStr(s.time)}</td><td class="${s.side==='buy'?'up':'down'}">${s.side==='buy'?'Buy':'Sell'}</td><td><b>${escapeHTML(s.symbol||'—')}</b></td><td>${money(s.price)}</td><td>${Number(s.amount||0).toLocaleString('en-US',{maximumFractionDigits:4})}</td><td class="warn">${money(s.usd)}</td><td><div class="asset"><span class="coin-icon" style="background:rgba(8,231,247,.15);color:#08e7f7">★</span><span class="asset-name"><b>${((()=>{const _n=noteHtml(s.wallet_note);return _n==='—'?escapeHTML(short(s.wallet)):_n})())}</b><span title="${escapeHTML(s.wallet)}">${short(s.wallet)}</span></span></div></td><td><a class="tx-link" href="https://${s.chain||'bsc'}scan.com/tx/${escapeHTML(s.tx)}" target="_blank" rel="noreferrer">View</a></td></tr>`).join('')||'<tr><td colspan="8" class="cg-empty">No Smart Money trades. Add a wallet in Wallets & Library to begin tracking buy and sell signals.</td></tr>'}</tbody></table></div></section>
    ${flowSection}`;
    const indicatorSection=`<section class="panel sm-panel"><div class="panel-head"><h2>SMART MONEY INDICATORS</h2><span>${cats.length} CATEGORIES</span></div><div class="sm-grid">${cats.map(c=>`<div class="sm-card"><div class="sm-num">${c.count}</div><div class="sm-name">${escapeHTML(c.name)}</div><div class="sm-bar"><i style="width:${Math.min(100,Math.round(c.count/(stats.total||1)*100*4))}%"></i></div></div>`).join('')||'<div class="cg-empty">No Smart Money data</div>'}</div></section>`;
    const librarySection=`<section class="panel"><div class="panel-head"><h2>ALL SMART MONEY WALLETS</h2><span>${shownWallets.length} / ${totalIn}</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>#</th><th>ADDRESS</th><th>LABEL</th><th>CHAIN</th></tr></thead><tbody>${shownWallets.map((w,i)=>`<tr><td class="rank-id">${i+1}</td><td><span class="addr-cell" title="${escapeHTML(w.address)}">${short(w.address)}</span></td><td><span class="sm-chip">${escapeHTML(w.label_en||'—')}</span></td><td><span class="ex-badge">${escapeHTML(w.chain||'solana')}</span></td></tr>`).join('')||'<tr><td colspan="4" class="cg-empty">No matching wallets found</td></tr>'}</tbody></table></div></section>`;
    const walletsTab=`${heroForm}${metrics}${walletListSection}${indicatorSection}${librarySection}`;
    const html=`<style>.sm-chip{display:inline-block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}.sm-navbar{display:flex;gap:8px;margin:14px 0 4px;flex-wrap:wrap}.sm-nav{padding:8px 20px;font-size:14px;background:rgba(128,128,128,.08);border:1px solid rgba(128,128,128,.2);border-radius:8px;color:inherit;cursor:pointer;transition:all .15s}.sm-nav:hover{border-color:rgba(79,140,255,.4)}.sm-nav.active{background:rgba(79,140,255,.16);border-color:rgba(79,140,255,.5);color:#8ab6ff;font-weight:600}@media(max-width:640px){.sm-chip{max-width:120px}}</style>
    <div class="page-head"><div><h1>Smart Money</h1></div><div class="page-actions"></div></div>
    ${tabBar}
    ${tab==='trades'?tradesTab:walletsTab}`;
    if (unchanged(snap, html)) return;
    snap.current = snapshot(html);
    withScroll(root, '.table-scroll', () => { root.innerHTML = html; });
    // \u4ea4\u6613\u6d41\u4ea4\u4e92
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;paint()});
    root.querySelectorAll('[data-f]').forEach(t=>t.onclick=()=>{filter=t.dataset.f;paint()});
    const inp=root.querySelector('#smSearch'),btn=root.querySelector('#smSearchBtn');
    const doSearch=()=>{q=(inp?.value||'').trim();paint()};
    if(inp){inp.onkeydown=e=>{if(e.key==='Enter')doSearch()}}
    if(btn)btn.onclick=doSearch;
    // Smart Wallet\u4ea4\u4e92
    root.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{if(b.disabled)return;page+=b.dataset.page==='next'?1:-1;if(page<1)page=1;paint()});
    const swForm=root.querySelector('#swForm');
    if(swForm)swForm.onsubmit=async e=>{
      e.preventDefault();
      const address=root.querySelector('#swAddr').value.trim();
      const chain=root.querySelector('#swChain').value;
      const note=root.querySelector('#swNote').value.trim();
      if(!/^0x[a-fA-F0-9]{40}$/.test(address)){root.querySelector('#swAddr').focus();return}
      const b=e.currentTarget.querySelector('button');b.disabled=true;
      try{
        const out=asObject(await api.smartWalletAdd(address,chain,note));
        if(!isMounted(root))return;
        if(!out.ok)throw new Error(out.message||'Add failed');
        root.querySelector('#swAddr').value='';root.querySelector('#swNote').value='';
        await paint();
      }catch(err){if(isMounted(root))alert(err.message)}finally{b.disabled=false}
    };
    root.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete this smart wallet?'))return;
      try{await api.smartWalletDelete(b.dataset.del);paint()}catch(err){alert(err.message)}
    });
    renderAIRail();
  };
  await paint();
  timer=setInterval(()=>paint().catch(()=>{}),30000);
  return ()=>{clearInterval(timer)};
}
