import {api} from '../../services/api.js';
import {money,compact,escapeHTML,time,noteHtml} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, skeleton} from '../../utils/render.js';

const short=a=>a?`${String(a).slice(0,6)}…${String(a).slice(-4)}`:'—';
const CHAINS=[['bsc','BSC'],['eth','Ethereum'],['base','Base'],['arbitrum','Arbitrum'],['polygon','Polygon']];

export async function renderSmartWallet(root){
  const snap={current:null};
  let timer,wallets=[],stream=[],stats={},error='',page=1,profile=null,profileError='',profileLoading=false;
  root.innerHTML=skeleton({cards:4,panels:2,rows:5,cols:9});
  const paint=async()=>{
    if(!isMounted(root))return;
    try{
      const out=asObject(await api.smartMoney(60));
      if(!isMounted(root))return;
      if(!out.ok)throw new Error(out.error||'Load failed');
      wallets=asArray(out.wallets);stream=asArray(out.stream);stats=asObject(out.stats);error='';
    }catch(e){error=e.message}
    if(!isMounted(root))return;
    const n=wallets.length;
    // \u6392\u5e8f（2026-08-09）：X Chain\u63a5 → \u6709Note → NoneNote（Stable\u6392\u5e8f，\u4e0d\u5206 Page\u524d）
    const tier = w => /x\.com/.test(w.note||'') ? 0 : (((w.note||'').trim()) ? 1 : 2);
    const sorted = wallets.map((w,i)=>({w,i})).sort((a,b)=>tier(a.w)-tier(b.w)||a.i-b.i).map(x=>x.w);
    // \u5206 Page：\u6bcf Page 20
    const PAGE=20, pages=Math.max(1,Math.ceil(sorted.length/PAGE));
    if(page>pages)page=pages;
    const wl=sorted.slice((page-1)*PAGE,page*PAGE);
    const pager=`<div style="display:flex;align-items:center;gap:10px;margin:10px 2px 2px"><button class="terminal-btn" data-page="prev" style="padding:4px 14px;font-size:12px" ${page<=1?'disabled':''}>← Previous</button><span style="font-size:12px;opacity:.7">Page  ${page} / ${pages}  Page · Total  ${n}  Assets</span><button class="terminal-btn" data-page="next" style="padding:4px 14px;font-size:12px" ${page>=pages?'disabled':''}>Next →</button></div>`;
    const profileView=profile?`<section class="panel wallet-profile-panel"><div class="panel-head"><div><h2>WALLET BEHAVIOR PROFILE</h2><p>${escapeHTML(profile.address||'')}</p></div><span>${profile.updated_at?`UPDATED ${time(profile.updated_at)}`:'LIVE ANALYSIS'}</span></div><div class="overview-grid" style="padding:14px">${[
      ['Profile Type',profileType(profile),'based on observed flows'],
      ['Net Flow',money(profile.net_usd),(profile.net_usd||0)>=0?'net accumulation':'net distribution'],
      ['Activity',String(profile.event_count||0),'large on-chain events'],
      ['Token Reach',String(profile.token_count||0),'observed assets'],
    ].map((x,i)=>`<article class="metric-card"><div class="metric-label">${x[0]}</div><div class="metric-value ${i===1?((profile.net_usd||0)>=0?'up':'down'):''}">${escapeHTML(x[1])}</div><div class="metric-sub">${escapeHTML(x[2])}</div></article>`).join('')}</div><div class="wallet-profile-grid"><div><h3>FLOW SUMMARY</h3><dl class="profile-facts"><div><dt>Inflow</dt><dd class="up">${money(profile.total_in_usd)}</dd></div><div><dt>Outflow</dt><dd class="down">${money(profile.total_out_usd)}</dd></div><div><dt>Exchange</dt><dd>${escapeHTML(profile.is_exchange||'Not identified')}</dd></div><div><dt>Confidence</dt><dd>${profileConfidence(profile)}</dd></div></dl></div><div><h3>TOP COUNTERPARTIES</h3><div class="profile-counterparties">${asArray(profile.top_counterparties).slice(0,6).map(row=>`<div><span>${escapeHTML(row.label||short(row.address))}</span><b>${money(row.usd)}</b></div>`).join('')||'<p class="cg-empty">No observed counterparties in the current window.</p>'}</div></div></div><p class="form-help">Profile is based on large transfers currently observed by TraceRoot. It is behavioral intelligence, not proof of identity or investment advice.</p></section>`:profileError?`<div class="empty-page"><b>Profile unavailable</b><p>${escapeHTML(profileError)}</p></div>`:'';
    const html=`<div class="page-head"><div><h1>Smart Money</h1><p>SMART WALLET TRADING MONITOR · TRACE THE ROOT</p></div><div class="page-actions"><span class="engine-state"><i class="status-dot ${n?'':'off'}"></i><small>${n} SMART WALLETS · 5MIN CYCLE</small></span></div></div>
      <div class="wallet-hero"><form id="profileForm" class="wallet-form"><input id="profileAddr" class="terminal-input wallet-input" placeholder="Enter 0x wallet address for behavioral profile" spellcheck="false" value="${escapeHTML(profile?.address||'')}"><button class="terminal-btn primary" ${profileLoading?'disabled':''}>${profileLoading?'ANALYZING...':'ANALYZE WALLET'}</button></form><p class="form-help">Generate a read-only wallet profile from observed on-chain flows. No wallet connection or signature is required.</p></div>${profileView}
      <div class="wallet-hero"><form id="swForm" class="wallet-form"><input id="swAddr" class="terminal-input wallet-input" placeholder="Enter 0x smart wallet address…" spellcheck="false"><select id="swChain" class="terminal-select">${CHAINS.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('')}</select><input id="swNote" class="terminal-input wallet-input" style="flex:.6" placeholder="Note（Optional）" maxlength="80"><button class="terminal-btn primary">Add</button></form><p class="form-help">after adding a smart wallet，auto-monitor 6h on-chain transfers（≥$1,000），track smart money。</p></div>
      <div class="overview-grid">${[
        ['Smart Wallet',`<b>${n}</b>`,'smart wallets tracked'],
        ['On-Chain Events',`<b>${stats.events??0}</b>`,'≥ $1,000 transfers'],
        ['Total In(6H)',`<b class="up">${money(stats.total_in_usd)}</b>`,'inbound USD'],
        ['Net Flow(6H)',`<b class="${(stats.net_usd||0)>=0?'up':'down'}">${money(stats.net_usd)}</b>`,'in − out'],
      ].map(x=>`<article class="metric-card"><div class="metric-label">${x[0]}</div><div class="metric-value">${x[1]}</div><div class="metric-sub">${x[2]}</div></article>`).join('')}</div>
      ${error?`<div class="empty-page"><b>Load failed</b><p>${escapeHTML(error)}</p></div>`:`
      ${n?`<section class="panel"><div class="panel-head"><h2>SMART WALLET LIST</h2><span>${wl.length} / ${n} · PAGE ${page}/${pages}</span></div>${pager}<div class="table-scroll"><table class="market-table"><thead><tr><th>WALLET</th><th>CHAIN</th><th>Note</th><th>Events</th><th>In(6H)</th><th>Out(6H)</th><th>Net</th><th>Last Activity</th><th></th></tr></thead><tbody>${wl.map(w=>`<tr><td><div class="asset"><span class="coin-icon">${escapeHTML((w.note||w.address).slice(0,2).toUpperCase())}</span><span class="asset-name"><b>${short(w.address)}</b><span>${escapeHTML(w.address)}</span></span></div></td><td><span class="ex-badge">${escapeHTML(w.chain_name||w.chain)}</span></td><td>${noteHtml(w.note)}</td><td>${w.event_count}</td><td class="up">${money(w.total_in_usd)}</td><td class="down">${money(w.total_out_usd)}</td><td class="${(w.net_usd||0)>=0?'up':'down'}">${money(w.net_usd)}</td><td>${w.last_event?time(w.last_event.time):'—'}</td><td><button class="terminal-btn sw-del" data-del="${escapeHTML(w.address)}">Delete</button></td></tr>`).join('')||`<tr><td colspan="9" class="cg-empty">NoneWallet</td></tr>`}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>SMART MONEY FLOW</h2><span>${stream.length} EVENTS</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>TIME</th><th>TOKEN</th><th>SMART WALLET</th><th>Side</th><th>COUNTERPARTY</th><th>AMOUNT</th><th>USD</th><th>FLAG</th></tr></thead><tbody>${stream.map(e=>{const isIn=(e.to||'').toLowerCase()===(e.wallet||'').toLowerCase();const other=isIn?e.from:e.to;const exName=e.to_exchange;const wn=noteHtml(e.wallet_note);return`<tr><td>${time(e.time)}</td><td><b>${escapeHTML(e.symbol)}</b></td><td><span class="addr-cell">${wn==='—'?escapeHTML(short(e.wallet)):wn}</span></td><td class="${isIn?'up':'down'}">${isIn?'In':'Out'}</td><td>${short(other)}</td><td>${Number(e.amount||0).toLocaleString('en-US',{maximumFractionDigits:4})}</td><td class="warn">${money(e.usd)}</td><td>${exName?`<span class="ex-badge">${escapeHTML(exName)}</span>`:'<span class="cg-empty">—</span>'}</td></tr>`}).join('')||'<tr><td colspan="8" class="cg-empty">no large transfers in 6h</td></tr>'}</tbody></table></div></section>`:`<div class="empty-page"><b>No smart wallets</b><p>add your first smart wallet above，to start tracking smart money。</p></div>`}`}`
    if (unchanged(snap, html)) return;
    snap.current = snapshot(html);
    withScroll(root, '.table-scroll', () => { root.innerHTML = html; });
    root.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{if(b.disabled)return;page+=b.dataset.page==='next'?1:-1;if(page<1)page=1;paint();});
    root.querySelector('#profileForm').onsubmit=async e=>{
      e.preventDefault();
      const address=root.querySelector('#profileAddr').value.trim();
      if(!/^0x[a-fA-F0-9]{40}$/.test(address)){root.querySelector('#profileAddr').focus();return}
      profileLoading=true;profileError='';profile=null;await paint();
      try{const out=asObject(await api.walletProfile(address));if(!out.ok)throw new Error(out.error||'Profile query failed');profile=asObject(out.data);profileError=''}
      catch(err){profileError=err.message||'Profile query failed'}
      finally{profileLoading=false;if(isMounted(root))await paint()}
    };
    root.querySelector('#swForm').onsubmit=async e=>{
      e.preventDefault();
      const address=root.querySelector('#swAddr').value.trim();
      const chain=root.querySelector('#swChain').value;
      const note=root.querySelector('#swNote').value.trim();
      if(!/^0x[a-fA-F0-9]{40}$/.test(address)){root.querySelector('#swAddr').focus();return}
      const btn=e.currentTarget.querySelector('button');btn.disabled=true;
      try{
        const out=asObject(await api.smartWalletAdd(address,chain,note));
        if(!isMounted(root))return;
        if(!out.ok)throw new Error(out.message||'Add failed');
        root.querySelector('#swAddr').value='';root.querySelector('#swNote').value='';
        await paint();
      }catch(err){if(isMounted(root))alert(err.message)}finally{btn.disabled=false}
    };
    root.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete this smart wallet?'))return;
      try{await api.smartWalletDelete(b.dataset.del);paint()}catch(err){alert(err.message)}
    });
    renderAIRail();
  };
  await paint();
  timer=setInterval(()=>paint().catch(()=>{}),30000);
  return()=>clearInterval(timer);
}

function profileType(profile){
  if(profile.is_exchange)return 'Exchange / Service';
  const activity=Number(profile.event_count||0),net=Number(profile.net_usd||0),gross=Number(profile.total_in_usd||0)+Number(profile.total_out_usd||0);
  if(!activity)return 'Insufficient Data';
  if(gross&&Math.abs(net)/gross<0.15)return 'Active Rotator';
  return net>0?'Net Accumulator':'Net Distributor';
}

function profileConfidence(profile){
  const n=Number(profile.event_count||0);
  return n>=20?'High':n>=5?'Medium':'Low';
}
