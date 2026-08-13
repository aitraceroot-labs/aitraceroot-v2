import {api} from '../../services/api.js';
import {money,compact,escapeHTML,time} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';
import {withScroll, unchanged, snapshot, skeleton} from '../../utils/render.js';

const short=a=>a?`${String(a).slice(0,6)}…${String(a).slice(-4)}`:'—';
const levelBadge=l=>`<span class="status-pill ${l==='high'?'running':l==='medium'?'pending':''}">${l==='high'?'HIGH':l==='medium'?'MEDIUM':'LOW'}</span>`;
const chainName=c=>({eth:'ETH',bsc:'BSC',base:'BASE',sol:'SOL'}[c]||c||'—');

// Risk Flags\u5fbd\u7ae0（\u5185\u8054\u6837\u5f0f，\u907f\u514d\u52a8\u5168\u5c40 CSS \u54c8\u5e0c\u6587\u4ef6）
const FLAG_META={
  HONEYPOT:['#f6465d','rgba(246,70,93,.14)','rgba(246,70,93,.45)','Honeypot: buys enabled, sells blocked'],
  BLACKLIST:['#ff4d6d','rgba(255,77,109,.12)','rgba(255,77,109,.4)','Trading blacklist'],
  GMGN_ALERT:['#ff9f43','rgba(255,159,67,.12)','rgba(255,159,67,.4)','External Risk Alert'],
  HIGH_TAX:['#f0b90b','rgba(240,185,11,.12)','rgba(240,185,11,.4)','Buy/Sell Tax >= 10%'],
  OWNER_RISK:['#a78bfa','rgba(167,139,250,.12)','rgba(167,139,250,.4)','Ownership not renounced：May freeze, mint or invoke privileged functions'],
  CONCENTRATED:['#08e7f7','rgba(8,231,247,.1)','rgba(8,231,247,.35)','Top 10 Holdings > 90% (Holder concentration)'],
};
const flagHtml=f=>{
  const m=FLAG_META[f]||['#8b93a7','rgba(139,147,167,.1)','rgba(139,147,167,.35)',''];
  return `<span title="${m[3]}" style="display:inline-block;padding:1px 6px;border-radius:4px;font:600 9px/1.5 monospace;letter-spacing:.05em;color:${m[0]};background:${m[1]};border:1px solid ${m[2]};margin:1px 4px 1px 0">${f}</span>`;
};
const pct=(v,d=1)=>v==null?'—':`${(Number(v)*100).toFixed(d)}%`;
const taxTxt=r=>{
  const b=r.buy_tax,s=r.sell_tax;
  const zero=v=>v==null||v===''||Number(v)===0;
  if(zero(b)&&zero(s)&&!(r.flags||[]).includes('HIGH_TAX'))return '<span class="cg-empty">—</span>';
  return `${zero(b)?'0':b} / ${zero(s)?'0':s}%`;
};

// \u7efc\u5408Risk\u7b49\u7ea7\u5927\u5fbd\u7ae0（\u5ba1\u8ba1\u7ed3\u679c\u7528）
const FINAL_STYLE={
  high:['#f6465d','rgba(246,70,93,.16)','rgba(246,70,93,.5)','HIGH RISK','High risk: severe issues such as honeypot or blacklist behavior were detected.'],
  medium:['#f0b90b','rgba(240,185,11,.14)','rgba(240,185,11,.45)','MEDIUM RISK','Medium risk: high taxes, privileged permissions or holder concentration require caution.'],
  low:['#0ecb81','rgba(14,203,129,.13)','rgba(14,203,129,.4)','LOW RISK','No obvious risk detected. This does not guarantee safety.'],
};
const levelBubble=l=>{
  const s=FINAL_STYLE[l]||FINAL_STYLE.low;
  return `<div style="display:flex;align-items:center;gap:12px">
    <span style="display:inline-block;min-width:118px;text-align:center;padding:7px 14px;border-radius:8px;font:800 15px/1.3 monospace;letter-spacing:.08em;color:${s[0]};background:${s[1]};border:1px solid ${s[2]}">${s[3]}</span>
    <div style="font-size:11px;color:var(--muted);line-height:1.5">${s[4]}</div></div>`;
};
const catTag=c=>({'CONTRACT_RISK':'ContractRisk','TRADE_RISK':'Trading Risk','SCAM_RISK':'Scam Risk'}[c]||c);

// Contract Address\u5ba1\u8ba1\u5165\u53e3Status（\u6a21\u5757\u7ea7，30s \u81ea\u52a8Refresh\u65f6\u4fdd\u7559\u7ed3\u679c）
let auditState=null;

const auditPanelHtml=()=>{
  const q=auditState?(auditState.query||''):'';
  const card=auditState&&(auditState.result||auditState.error||auditState.loading)?(()=>{
    if(auditState.loading)return `<div style="padding:12px;font-size:11px;color:var(--muted)">Audit in progress. Running multi-source security validation...</div>`;
    if(auditState.error)return `<div style="padding:12px;font-size:11px;color:#f6465d">${escapeHTML(auditState.error)}</div>`;
    const d=auditState.result;if(!d)return '';
    const bn=d.binance||{},gm=d.gmgn||{};
    const hits=bn.hits||[];
    const hitRow=h=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line-soft)">
      <span style="flex:none;display:inline-block;padding:1px 6px;border-radius:4px;font:600 9px/1.5 monospace;letter-spacing:.03em;color:${h.type==='RISK'?'#f6465d':'#f0b90b'};background:${h.type==='RISK'?'rgba(246,70,93,.13)':'rgba(240,185,11,.12)'};border:1px solid ${h.type==='RISK'?'rgba(246,70,93,.4)':'rgba(240,185,11,.35)'}">${h.type==='RISK'?'RISK':'CAUTION'}</span>
      <div style="min-width:0"><b style="font-size:11px">${escapeHTML(h.title)}</b><small style="display:block;color:var(--muted);font-size:10px;margin-top:2px;line-height:1.5">${escapeHTML(h.desc||'')}</small></div>
      <span style="margin-left:auto;flex:none;color:var(--muted);font-size:9px;font-family:monospace">${catTag(h.category)}</span></div>`;
    const flags=(gm.flags||[]).map(flagHtml).join('')||'<span class="cg-empty">—</span>';
    const meta=(t,v,cls='')=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:11px"><span style="color:var(--muted)">${t}</span><b style="font-weight:600;${cls?'color:'+cls:''}">${v}</b></div>`;
    return `<div style="padding:12px;border-top:1px solid var(--line-soft)">
      ${levelBubble(d.final_level)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:12px">
        <div>${meta('Contract Address',`<span style="font-family:monospace;font-size:10px">${short(d.address)}</span>`)}
        ${meta('Chain',`<span class="ex-badge">${chainName(d.chain)}</span>`)}
        ${meta('Risk Flags',flags)}
        ${meta('Top10 Holdings',pct(gm.top10_rate),Number(gm.top10_rate||0)>0.9?'#f6465d':'')}</div>
        <div>${meta('Audit Level',`${bn.risk_enum||'—'} (${bn.risk_level??'—'}/5)`)}
        ${meta('Buy/Sell Tax',`${(bn.buy_tax??'—')}% / ${(bn.sell_tax??'—')}%`)}
        ${meta('Contract Source Verified',bn.is_verified===true?'Yes':(bn.is_verified===false?'No':'Unknown'),bn.is_verified===false?'#f6465d':'')}
        ${meta('Audit Time',time(d.scanned_at))}</div>
      </div>
      ${hits.length?`<div style="margin-top:10px"><div style="font:600 10px monospace;letter-spacing:.08em;color:var(--muted);margin-bottom:2px">Findings · ${hits.length}</div>${hits.map(hitRow).join('')}</div>`:`<div style="margin-top:10px;padding:8px;border-radius:6px;background:rgba(14,203,129,.07);border:1px solid rgba(14,203,129,.25);font-size:11px;color:#0ecb81">No security findings（${bn.risk_enum||'LOW'}），Cross-validation: ${flags==='—'?'No flags':`Detected  ${(gm.flags||[]).join(', ')}`}</div>`}
      <div style="margin-top:10px;font-size:9px;color:var(--muted);line-height:1.5">⚠️ An audit is a point-in-time snapshot. LOW does not guarantee safety. Contract permissions and liquidity can change. Always do your own research.</div>
    </div>`;
  })():'';
  return `<section class="panel" style="margin-bottom:10px"><div class="panel-head"><h2>CONTRACT AUDIT</h2><span>Enter contract address · Multi-source security validation · No registration required</span></div>
    <div style="display:flex;gap:8px;padding:10px 12px">
      <input id="auditInput" class="terminal-input" style="flex:1;min-width:0;height:34px" placeholder="Paste a contract address: 0x... (ETH/BSC/BASE) or a Solana address, then press Enter to scan" value="${escapeHTML(q)}">
      <button id="auditBtn" class="terminal-btn primary" style="height:34px">Scan</button>
      <button id="auditClear" class="terminal-btn" style="height:34px">Clear</button>
    </div>${card}</section>`;
};

export async function renderRisk(root){
  const snap={current:null};
  let timer,data={},coins=[],coinsStatus=null,error='';
  root.innerHTML=skeleton({cards:4,panels:1,rows:5,cols:8});
  const doAudit=async()=>{
    const input=root.querySelector('#auditInput');
    const addr=(input?input.value:'').trim();
    if(!addr){auditState={error:'Enter a contract address.',query:''};paint();return;}
    auditState={loading:true,query:addr};
    paint();
    const out=await api.riskAudit(addr).catch(()=>({ok:false,error:'Audit request failed. Please try again later.'}));
    if(!isMounted(root))return;
    if(out&&out.ok&&out.data)auditState={result:out.data,query:addr};
    else auditState={error:(out&&out.error)||'Audit failed',query:addr};
    paint();
  };
  const paint=async()=>{
    if(!isMounted(root))return;
    try{
      const [alertsOut,coinsOut]=await Promise.all([
        api.riskAlerts(60).catch(()=>null),
        api.riskCoins(100).catch(()=>null),
      ]);
      if(!isMounted(root))return;
      if(!alertsOut||!alertsOut.ok)throw new Error((alertsOut&&alertsOut.error)||'Load failed');
      data=alertsOut;error='';
      coins=asArray(coinsOut&&coinsOut.data);
      coinsStatus=asObject(coinsOut&&coinsOut.status);
    }catch(e){error=e.message}
    if(!isMounted(root))return;
    const alerts=asArray(data.data);
    const st=asObject(data.status);
    const high=alerts.filter(x=>x.level==='high').length;
    const medium=alerts.filter(x=>x.level==='medium').length;
    const toEx=alerts.filter(x=>x.to_exchange).length;
    const hasFlag=f=>coins.filter(x=>x.flags&&x.flags.includes(f)).length;
    const honeypots=hasFlag('HONEYPOT'),blacklisted=hasFlag('BLACKLIST'),
          highTax=hasFlag('HIGH_TAX'),ownerRisk=hasFlag('OWNER_RISK'),
          concentrated=hasFlag('CONCENTRATED');
    const scanTxt=coinsStatus
      ? `Scanned ${coinsStatus.scanned??0}/${coinsStatus.total??'—'} · Found ${coins.length}  risk assets${coinsStatus.updated_at?(' · '+time(coinsStatus.updated_at)):''}`
      : 'Risk asset scan unavailable';
    const coinsRow=c=>`<tr><td>${levelBadge(c.level)}</td>
      <td><b>${escapeHTML(c.symbol)}</b>${c.name?`<small style="display:block;color:var(--muted);font-size:10px">${escapeHTML(String(c.name).slice(0,24))}</small>`:''}</td>
      <td><span class="ex-badge">${chainName(c.chain)}</span></td>
      <td>${(c.flags||[]).map(flagHtml).join('')||'<span class="cg-empty">—</span>'}</td>
      <td style="font-variant-numeric:tabular-nums">${taxTxt(c)}</td>
      <td class="${Number(c.top10_rate||0)>0.9?'down':'neutral'}" style="font-variant-numeric:tabular-nums">${pct(c.top10_rate)}</td>
      <td>${c.price_usd?money(c.price_usd):'<span class="cg-empty">—</span>'}</td></tr>`;
    const html=`<div class="page-head"><div><h1>Risk Alert</h1><p>ON-CHAIN RISK MONITORING · EARLY WARNING</p></div><div class="page-actions"><span class="engine-state"><i class="status-dot ${alerts.length?'':'off'}"></i><small>${st.events??0} EVENTS · 5MIN CYCLE</small></span></div></div>
      ${auditPanelHtml()}
      <div class="overview-grid">${[
        ['Large Events',`<b>${st.events??0}</b>`,'Last 6 Hours ≥ $1,000'],
        ['High',`<b class="down">${high}</b>`,'≥ $50K or to exchange'],
        ['Medium',`<b class="warn">${medium}</b>`,'≥ $20K'],
        ['To Exchange',`<b class="down">${toEx}</b>`,'Sell Signal'],
      ].map(x=>`<article class="metric-card"><div class="metric-label">${x[0]}</div><div class="metric-value">${x[1]}</div><div class="metric-sub">${x[2]}</div></article>`).join('')}</div>
      ${error?`<div class="empty-page"><b>Alert data unavailable</b><p>${escapeHTML(error)}</p></div>`:`
      <section class="panel" style="margin-bottom:10px"><div class="panel-head"><h2>RISK TOKENS</h2><span>Honeypot / Blacklist / High Tax / Permission Risk / Holder Concentration · SECURITY DATA</span></div>
        <div class="overview-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));padding:10px 10px 0">${[
          ['Honeypot HONEYPOT',`<b class="down">${honeypots}</b>`,'Funds can enter but cannot exit; buys may be locked.'],
          ['Blacklist',`<b class="down">${blacklisted}</b>`,'Trading is blacklisted.'],
          ['High Buy/Sell Tax',`<b class="warn">${highTax}</b>`,'Buy/Sell tax ≥ 10%'],
          ['Permission Risk',`<b class="warn">${ownerRisk+concentrated}</b>`,'Ownership not renounced / Holder concentration'],
        ].map(x=>`<article class="metric-card"><div class="metric-label">${x[0]}</div><div class="metric-value">${x[1]}</div><div class="metric-sub">${x[2]}</div></article>`).join('')}</div>
        <div class="table-scroll"><table class="market-table"><thead><tr><th>LEVEL</th><th>TOKEN</th><th>CHAIN</th><th>RISK FLAGS</th><th>BUY/SELL TAX</th><th>TOP10</th><th>PRICE</th></tr></thead><tbody>${
          coins.slice(0,15).map(coinsRow).join('')||`<tr><td colspan="7" class="cg-empty">${coinsStatus&&coinsStatus.total?`Scanning：${scanTxt}`:'No risk asset data (scanning)'}</td></tr>`
        }</tbody></table></div>
        <div style="padding:7px 12px;font-size:10px;color:var(--muted);border-top:1px solid var(--line-soft)">${scanTxt}</div>
      </section>
      <section class="panel"><div class="panel-head"><h2>CHAIN RISK STREAM</h2><span>${alerts.length} ALERTS · BY USD</span></div><div class="table-scroll"><table class="market-table"><thead><tr><th>LEVEL</th><th>TOKEN</th><th>TIME</th><th>FROM → TO</th><th>AMOUNT</th><th>USD</th><th>FLAG</th><th>TX</th></tr></thead><tbody>${alerts.map(a=>{const isIn=false;const dir=a.to_exchange?'SELL→EX':(isIn?'IN':'MOVE');return`<tr><td>${levelBadge(a.level)}</td><td><b>${escapeHTML(a.symbol)}</b></td><td>${time(a.time)}</td><td>${short(a.from)} → ${short(a.to)}</td><td>${Number(a.amount||0).toLocaleString('en-US',{maximumFractionDigits:4})}</td><td class="warn">${money(a.usd)}</td><td>${a.to_exchange?`<span class="ex-badge">${escapeHTML(a.to_exchange)}</span>`:`<span class="cg-empty">—</span>`}</td><td><a class="tx-link" href="https://${a.chain||'bsc'}.com/tx/${escapeHTML(a.tx)}" target="_blank" rel="noreferrer">View</a></td></tr>`}).join('')||'<tr><td colspan="8" class="cg-empty">No large transfers now</td></tr>'}</tbody></table></div></section>`}`
    if (unchanged(snap, html)) return;
    snap.current = snapshot(html);
    withScroll(root, '.table-scroll', () => { root.innerHTML = html; });
    const input=root.querySelector('#auditInput');
    if(input){
      input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();doAudit();}};
      const btn=root.querySelector('#auditBtn');
      if(btn)btn.onclick=doAudit;
      const clr=root.querySelector('#auditClear');
      if(clr)clr.onclick=()=>{auditState=null;input.value='';paint();};
    }
    renderAIRail();
  };
  await paint();
  timer=setInterval(()=>paint().catch(()=>{}),30000);
  return()=>clearInterval(timer);
}
