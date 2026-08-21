import {escapeHTML} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {api} from '../../services/api.js';

const DEFAULT_PROFILE={ai_name:'AITRA',ai_personality:'analyst',ai_tone:'professional',ai_response_style:'balanced',ai_language:'auto'};
const PERSONALITIES=[
  ['analyst','Market Analyst','Evidence-led, rigorous and uncertainty-aware'],
  ['strategist','Strategy Advisor','Scenarios, catalysts, invalidation and risk'],
  ['mentor','Patient Mentor','Explains terminology and reasoning step by step'],
  ['companion','Research Companion','Approachable, collaborative and factual'],
];
const OPTIONS={
  ai_tone:[['professional','Professional'],['friendly','Friendly'],['direct','Direct'],['cautious','Risk Cautious']],
  ai_response_style:[['concise','Concise'],['balanced','Balanced'],['detailed','Detailed']],
  ai_language:[['auto','Follow User'],['zh-CN','Simplified Chinese'],['en','English']],
};
const short=address=>address?`${address.slice(0,6)}...${address.slice(-4)}`:'Not connected';
const wallets=()=>{try{const value=JSON.parse(localStorage.getItem('v2-wallets')||'[]');return Array.isArray(value)?value:[]}catch{return[]}};

export async function renderUser(root){
  const [health,sessionResult]=await Promise.all([
    api.systemHealth().catch(()=>({status:'error',data:{api:'degraded',database:'unknown',data_updated_at:0,missing_avatars:0,failed_requests:1}})),
    api.walletSession().catch(()=>({ok:false,authenticated:false})),
  ]);
  let verified=Boolean(sessionResult?.authenticated||sessionResult?.verified);
  let profile={...DEFAULT_PROFILE};
  let saveMessage='';
  if(verified){
    try{const result=await api.userProfile();profile={...profile,...(result?.profile||{})}}catch{verified=false}
  }

  const paint=()=>{
    const current=localStorage.getItem('v2-wallet')||sessionResult?.address||'';
    const saved=wallets();
    const h=health.data||{};
    const updated=h.data_updated_at?new Date(h.data_updated_at*1000).toLocaleString('en-US'):'No Data';
    root.innerHTML=`<div class="page-head"><div><h1>User Center</h1><p>WALLET IDENTITY · PRIVATE AI PROFILE · PROTECTED SETTINGS</p></div><div class="page-actions"><span class="status-live ${verified?'':'warn'}">● ${verified?'WALLET VERIFIED':'VERIFICATION REQUIRED'}</span></div></div>
      <div class="user-grid"><section class="panel profile-card"><div class="avatar-large">AI</div><h2>${current?short(current):'Wallet Required'}</h2><p>${verified?'VERIFIED WALLET SESSION':current?'CONNECTED · NOT VERIFIED':'CONNECT A WALLET TO CONTINUE'}</p><button id="walletCenterConnect" class="terminal-btn primary" type="button">${verified?'Manage Wallets':current?'Verify Wallet':'Connect Wallet'}</button></section>
      <section class="panel"><div class="panel-head"><h2>Wallet Access</h2><span>${verified?'OWNER VERIFIED · SERVER SESSION':'NON-CUSTODIAL · SIGNATURE REQUIRED'}</span></div><div class="form-grid"><p class="wallet-only-note">A wallet signature proves ownership and protects AI settings, watchlists and private strategy data. A connected address alone is not authentication.</p>${saved.length?`<div class="wallet-account-list">${saved.map(wallet=>`<button class="wallet-option ${String(wallet.addr).toLowerCase()===current.toLowerCase()?'active':''}" data-wallet-address="${escapeHTML(wallet.addr)}"><span class="wo-dot"></span><b>${short(wallet.addr)}</b><span>${escapeHTML(wallet.provider||'wallet')}</span></button>`).join('')}</div>`:'<div class="push-empty">No wallet connected yet.</div>'}</div></section></div>
      <section class="panel ai-profile-panel"><div class="panel-head"><div><h2>AI Chat Identity &amp; Personality</h2><p>Your preferences are encrypted and bound to the verified wallet.</p></div><span>PRIVATE PROFILE</span></div>
        ${verified?`<form id="aiProfileForm" class="ai-profile-form">
          <label class="ai-name-field"><span>AI CHAT NAME</span><input class="terminal-input" id="aiProfileName" maxlength="24" value="${escapeHTML(profile.ai_name)}" placeholder="AITRA" pattern="[A-Za-z0-9\u3400-\u9fff ]{1,24}" required><small>1-24 letters, numbers or spaces</small></label>
          <fieldset><legend>PERSONALITY</legend><div class="ai-personality-grid">${PERSONALITIES.map(([value,label,description])=>`<label class="ai-personality-card ${profile.ai_personality===value?'active':''}"><input type="radio" name="aiPersonality" value="${value}" ${profile.ai_personality===value?'checked':''}><b>${label}</b><span>${description}</span></label>`).join('')}</div></fieldset>
          <div class="ai-profile-selects">${Object.entries(OPTIONS).map(([key,rows])=>`<label><span>${key==='ai_tone'?'TONE':key==='ai_response_style'?'ANSWER DEPTH':'LANGUAGE'}</span><select class="terminal-select" id="${key}">${rows.map(([value,label])=>`<option value="${value}" ${profile[key]===value?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div>
          <div class="ai-profile-preview"><span>PROFILE PREVIEW</span><b id="aiProfilePreview">${escapeHTML(profile.ai_name)} · ${escapeHTML(PERSONALITIES.find(row=>row[0]===profile.ai_personality)?.[1]||'Market Analyst')}</b><p>Safety rules, factual accuracy requirements and trading-risk controls always remain active.</p></div>
          <div class="ai-profile-actions"><span id="aiProfileStatus">${escapeHTML(saveMessage||'Settings apply to new AI Chat messages after saving.')}</span><button class="terminal-btn primary" id="aiProfileSave" type="submit">SAVE AI PROFILE</button></div>
        </form>`:`<div class="ai-profile-locked"><b>Verify your wallet to customize AI Chat</b><p>Set a private name, personality, tone, answer depth and preferred language.</p><button class="terminal-btn primary" id="aiProfileVerify" type="button">VERIFY WALLET</button></div>`}
      </section>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>SYSTEM HEALTH MONITOR</h2><span>DAILY DATA QUALITY CHECK</span></div><div class="overview-grid" style="padding:14px"><article class="metric-card"><div class="metric-label">API STATUS</div><div class="metric-value ${h.api==='online'?'up':'down'}">${escapeHTML(h.api||'unknown')}</div></article><article class="metric-card"><div class="metric-label">DATABASE</div><div class="metric-value ${h.database==='online'?'up':'down'}">${escapeHTML(h.database||'unknown')}</div></article><article class="metric-card"><div class="metric-label">MISSING AVATARS</div><div class="metric-value ${Number(h.missing_avatars)>0?'down':'up'}">${Number(h.missing_avatars||0)}</div></article><article class="metric-card"><div class="metric-label">FAILED REQUESTS</div><div class="metric-value ${Number(h.failed_requests)>0?'down':'up'}">${Number(h.failed_requests||0)}</div></article></div><p class="form-help" style="padding:0 14px 14px">Data updated: ${escapeHTML(updated)}</p></section>`;

    root.querySelector('#walletCenterConnect')?.addEventListener('click',()=>{
      if(!current)document.querySelector('#walletBtn')?.click();
      else if(!verified)window.dispatchEvent(new CustomEvent('atr:verify-wallet',{detail:{address:current}}));
      else document.querySelector('#walletManage')?.click();
    });
    root.querySelector('#aiProfileVerify')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('atr:verify-wallet',{detail:{address:current}})));
    root.querySelectorAll('[data-wallet-address]').forEach(button=>button.onclick=()=>{localStorage.setItem('v2-wallet',button.dataset.walletAddress);window.dispatchEvent(new CustomEvent('atr:verify-wallet',{detail:{address:button.dataset.walletAddress}}))});
    root.querySelectorAll('.ai-personality-card input').forEach(input=>input.onchange=()=>{root.querySelectorAll('.ai-personality-card').forEach(card=>card.classList.toggle('active',card.contains(input)));updatePreview()});
    root.querySelector('#aiProfileName')?.addEventListener('input',updatePreview);
    root.querySelector('#aiProfileForm')?.addEventListener('submit',saveProfile);
  };

  const updatePreview=()=>{
    const target=root.querySelector('#aiProfilePreview');if(!target)return;
    const name=root.querySelector('#aiProfileName')?.value.trim()||'AITRA';
    const personality=root.querySelector('input[name="aiPersonality"]:checked')?.value||'analyst';
    target.textContent=`${name} · ${PERSONALITIES.find(row=>row[0]===personality)?.[1]||'Market Analyst'}`;
  };
  const saveProfile=async event=>{
    event.preventDefault();
    const button=root.querySelector('#aiProfileSave');const status=root.querySelector('#aiProfileStatus');
    const next={ai_name:root.querySelector('#aiProfileName').value.trim(),ai_personality:root.querySelector('input[name="aiPersonality"]:checked')?.value||'analyst',ai_tone:root.querySelector('#ai_tone').value,ai_response_style:root.querySelector('#ai_response_style').value,ai_language:root.querySelector('#ai_language').value};
    if(!next.ai_name){root.querySelector('#aiProfileName').focus();return}
    button.disabled=true;button.textContent='SAVING...';
    try{const result=await api.userProfileSave(next);if(!result?.ok)throw new Error(result?.error||'Unable to save AI profile');profile={...profile,...result.profile};saveMessage='AI profile saved. New chat messages will use these settings.';paint()}
    catch(error){status.textContent=error?.message||'Unable to save AI profile';status.classList.add('down');button.disabled=false;button.textContent='SAVE AI PROFILE'}
  };
  const onSession=async event=>{if(!(event.detail?.authenticated||event.detail?.verified))return;verified=true;try{const result=await api.userProfile();profile={...profile,...result.profile}}catch{}paint()};
  window.addEventListener('wallet-session-change',onSession);
  paint();renderAIRail();
  return()=>window.removeEventListener('wallet-session-change',onSession);
}


