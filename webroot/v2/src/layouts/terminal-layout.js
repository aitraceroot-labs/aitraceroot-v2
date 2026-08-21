import {routes, navigate} from '../app/router.js';
import {t} from '../i18n.js';
import {api} from '../services/api.js';

const paths={dashboard:'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',markets:'M4 18V9m5 9V5m5 13v-6m5 6V3',futures:'m7 7-3 3 3 3m-3-3h16m-3 7 3-3-3-3',wallet:'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm8 3h6M9 16v-1m-3-2h3',radar:'M12 12 19 5M5.6 18.4a9 9 0 1 1 12.8 0M8.5 15.5a5 5 0 1 1 7 0',risk:'M12 2 4 6v6c0 5 3.4 9.5 8 10 4.6-.5 8-5 8-10V6l-8-4Zm0 6v4m0 4h.01',follow:'M7 17 17 7m0 0H8m9 0v9',smartmoney:'M3 12h18M3 12l3-3m-3 3 3 3m12-3 3-3m-3 3-3 3M12 3v18M12 3l-3 3m3-3 3 3m-3 12-3-3m3 3 3-3',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.dashboard}"/></svg>`;

const mobileKeys = new Set(['dashboard','markets','futures']);
function navLinks(active, mobile=false) {
  return routes.filter(r => !mobile || mobileKeys.has(r.key)).map(r =>
    `<a href="${r.path}" data-nav class="${mobile?'':'nav-link '}${active===r.key?'active':''}">${mobile?`<i>${icon(r.icon)}</i>${mobileShort(r.label)}`:`<b class="nav-icon">${icon(r.icon)}</b><span>${t(r.label)}</span>`}</a>`
  ).join('');
}
function mobileShort(key) {
  const en = { 'nav.dashboard':'Terminal', 'nav.markets':'Markets', 'nav.futures':'Futures', 'nav.wallet':'Wallet', 'nav.alpha':'Alpha', 'nav.risk':'Risk', 'nav.follow':'Strategies', 'nav.smartmoney':'SM', 'nav.user':'Mine' };
  return en[key] || t(key);
}

export function renderLayout(active) {
  const groups = ['TERMINAL','INTELLIGENCE','ACCOUNT'];
  const side = groups.map(group => `<div class="nav-group"><div class="nav-label">${group}</div>${routes.filter(r=>r.group===group&&!r.hidden).map(r=>`<a href="${r.path}" data-nav class="nav-link ${active===r.key?'active':''}"><b class="nav-icon">${icon(r.icon)}</b><span>${t(r.label)}</span></a>`).join('')}</div>`).join('');
  const app=document.querySelector('#app');
  if(!app) throw new Error('Application root is missing');
  app.innerHTML = `<div class="terminal">
    <aside class="sidebar"><div class="side-brand"><img class="brand-mark-img" src="/v2/favicon.svg" alt="AITRACEROOT"><div class="brand-copy"><b>AITRACEROOT</b><span>${t('side.brandSub')}</span></div></div>${side}<div class="side-foot"><div class="engine-state"><span class="status-dot"></span><div><b>${t('side.engine')}</b><small>${t('side.mode')}</small></div></div></div></aside>
    <header class="topbar"><div class="market-status"><i class="status-dot"></i><span>${t('top.status')}</span></div><div class="system-cluster" aria-label="AI system status"><span><i></i>AI ENGINE ONLINE</span><span><i></i>MARKET DATA CONNECTED</span><span><i></i>ON-CHAIN SCANNER ACTIVE</span></div><div class="topbar-right"><div class="wallet-login" id="walletLogin"></div></div></header>
    <main class="workspace" id="workspace"></main><aside class="ai-rail" id="aiRail"></aside>
    <nav class="mobile-nav">${navLinks(active,true)}</nav></div>`;
  document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', e => {e.preventDefault();navigate(a.getAttribute('href'));}));
  renderWalletLogin();
  renderAIRail();
}

function escapeWalletName(n) { return String(n || '').replace(/[<>&"']/g, ''); }
function loadWallets() {
  try {
    const stored = JSON.parse(localStorage.getItem('v2-wallets') || '[]');
    const connected = Array.isArray(stored) ? stored.filter(wallet => wallet && wallet.provider !== 'manual') : [];
    if (connected.length !== stored.length) saveWallets(connected);
    return connected;
  } catch (e) { return []; }
}
function saveWallets(list) { localStorage.setItem('v2-wallets', JSON.stringify(list)); }
function getCurrent() { return localStorage.getItem('v2-wallet') || ''; }
function setCurrent(addr) { if (addr) localStorage.setItem('v2-wallet', addr); else localStorage.removeItem('v2-wallet'); }
function addWallet(addr, provider) {
  const list = loadWallets();
  const a = addr.toLowerCase();
  if (!list.find(w => w.addr.toLowerCase() === a)) {
    list.push({addr, provider: String(provider || 'wallet'), at: Date.now()});
    saveWallets(list);
  }
  setCurrent(addr);
}
function removeWallet(addr) {
  const a = addr.toLowerCase();
  saveWallets(loadWallets().filter(w => w.addr.toLowerCase() !== a));
  if ((getCurrent() || '').toLowerCase() === a) setCurrent('');
}
function injectedProviders() {
  const providers = window.ethereum?.providers || (window.ethereum ? [window.ethereum] : []);
  return Array.from(new Set(providers.filter(Boolean)));
}

let _walletSession = {verified:false, authenticated:false, wallet:''};
let _walletSessionReady = false;
let _walletSessionPromise = null;
let _verifyPromise = null;
let _verifyingAddress = '';
const _providerHints = new Map();
const _boundProviders = new WeakSet();

function sessionPayload(raw) {
  const value = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' ? raw.data : (raw || {});
  const wallet = String(value.wallet || value.address || value.wallet_address || '').trim().toLowerCase();
  const verified = Boolean(value.verified ?? value.authenticated ?? value.logged_in ?? (wallet && raw?.ok));
  return {...value, wallet, verified, authenticated:verified};
}

function publishWalletSession(next, error='') {
  _walletSession = {...sessionPayload(next), error:String(error || '')};
  window.__atrWalletSession = _walletSession;
  window.dispatchEvent(new CustomEvent('wallet-session-change', {detail:{..._walletSession}}));
  return _walletSession;
}

async function refreshWalletSession() {
  if (_walletSessionPromise) return _walletSessionPromise;
  _walletSessionPromise = (async () => {
    try {
      if (typeof api.walletSession !== 'function') throw new Error('Wallet authentication is unavailable.');
      const raw = await api.walletSession();
      let next = sessionPayload(raw);
      if (next.verified && next.wallet) {
        const selected = String(getCurrent() || '').toLowerCase();
        if (selected && selected !== next.wallet) {
          await api.walletLogout();
          next = {verified:false, authenticated:false, wallet:''};
        } else {
          const known = loadWallets().some(item => String(item?.addr || '').toLowerCase() === next.wallet);
          if (!known) addWallet(next.wallet, 'verified session');
          else setCurrent(next.wallet);
        }
      }
      publishWalletSession(next);
      return next;
    } catch (error) {
      const next = {verified:false, authenticated:false, wallet:'', error:String(error?.message || error)};
      publishWalletSession(next, next.error);
      return next;
    } finally {
      _walletSessionReady = true;
      _walletSessionPromise = null;
      renderWalletLogin();
    }
  })();
  return _walletSessionPromise;
}

function walletProvider(kind) {
  const providers = injectedProviders();
  const matches = {
    metamask: provider => provider.isMetaMask && !provider.isBraveWallet,
    okx: provider => provider.isOkxWallet || provider.isOKExWallet,
    trust: provider => provider.isTrust || provider.isTrustWallet,
    binance: provider => provider.isBinance || provider.isBinanceWallet,
    coinbase: provider => provider.isCoinbaseWallet
  };
  const direct = {
    okx: window.okxwallet,
    trust: window.trustwallet,
    binance: window.BinanceChain,
    coinbase: window.coinbaseWalletExtension
  }[kind];
  return direct || providers.find(matches[kind]) || null;
}

async function appKitProvider(address='') {
  const appKit = window.__appkit;
  if (appKit && typeof appKit.getWalletProvider === 'function') {
    try {
      const provider = await appKit.getWalletProvider();
      if (provider && typeof provider.request === 'function') return provider;
    } catch {}
  }
  const wanted = String(address || '').toLowerCase();
  for (const provider of injectedProviders()) {
    try {
      const accounts = await provider.request({method:'eth_accounts'});
      if (!wanted || (accounts || []).some(account => String(account).toLowerCase() === wanted)) return provider;
    } catch {}
  }
  return window.ethereum && typeof window.ethereum.request === 'function' ? window.ethereum : null;
}

function rememberProvider(address, provider) {
  const key = String(address || '').toLowerCase();
  if (key && provider && typeof provider.request === 'function') _providerHints.set(key, provider);
  if (!provider || typeof provider.on !== 'function' || _boundProviders.has(provider)) return;
  _boundProviders.add(provider);
  provider.on('accountsChanged', accounts => {
    const next = accounts && accounts[0];
    api.walletLogout?.().catch(()=>{}).finally(() => {
      publishWalletSession({verified:false, wallet:''});
      if (next) {
        addWallet(next, 'wallet');
        rememberProvider(next, provider);
      } else setCurrent('');
      renderWalletLogin();
      if (next) verifyWallet(next, provider).catch(()=>{});
    });
  });
}

async function providerFor(address) {
  const key = String(address || '').toLowerCase();
  return _providerHints.get(key) || appKitProvider(key);
}

async function verifyWallet(address=getCurrent(), provider=null) {
  const wanted = String(address || '').trim();
  if (!wanted) throw new Error('Connect a wallet before verification.');
  if (_verifyPromise) return _verifyPromise;
  _verifyingAddress = wanted.toLowerCase();
  renderWalletLogin();
  _verifyPromise = (async () => {
    try {
      if (!_walletSessionReady) await refreshWalletSession();
      if (_walletSession.verified && _walletSession.wallet !== wanted.toLowerCase()) {
        await api.walletLogout();
        publishWalletSession({verified:false, wallet:''});
      }
      const signer = provider || await providerFor(wanted);
      if (!signer || typeof signer.request !== 'function') throw new Error('Reopen your wallet to verify ownership.');
      rememberProvider(wanted, signer);
      const accounts = await signer.request({method:'eth_accounts'});
      const account = (accounts || []).find(item => String(item).toLowerCase() === wanted.toLowerCase());
      if (!account) throw new Error('The active wallet account does not match this address.');
      const challengeRaw = await api.walletChallenge(account);
      const challenge = challengeRaw?.data || challengeRaw || {};
      const message = String(challenge.message || '');
      if (!message) throw new Error('The server did not return a signing challenge.');
      const signature = await signer.request({method:'personal_sign', params:[message, account]});
      const verifiedRaw = await api.walletVerify(account, message, signature);
      const verified = sessionPayload(verifiedRaw);
      if (!verified.verified || (verified.wallet && verified.wallet !== account.toLowerCase())) throw new Error(verifiedRaw?.error || 'Wallet verification failed.');
      setCurrent(account);
      publishWalletSession(verified);
      return verified;
    } catch (error) {
      publishWalletSession({verified:false, wallet:''}, error?.message || error);
      throw error;
    } finally {
      _verifyingAddress = '';
      _verifyPromise = null;
      renderWalletLogin();
    }
  })();
  return _verifyPromise;
}

window.__atrVerifyWallet = verifyWallet;
window.__atrWalletSession = _walletSession;
window.addEventListener('atr:verify-wallet', event => {
  verifyWallet(event?.detail?.address || getCurrent(), event?.detail?.provider || null).catch(()=>{});
});

async function logoutWalletSession() {
  try { if (typeof api.walletLogout === 'function') await api.walletLogout(); } catch {}
  publishWalletSession({verified:false, wallet:''});
}

function renderWalletLogin() {
  const box = document.querySelector('#walletLogin');
  if (!window.__onAppKitConnect) window.__onAppKitConnect = (addr, chainId, provider=null) => {
    if (addr) {
      addWallet(addr, 'walletconnect' + (chainId ? '·' + chainId : ''));
      renderWalletLogin();
      Promise.resolve(provider || appKitProvider(addr)).then(signer => {
        if (signer) verifyWallet(addr, signer).catch(()=>{});
      }).catch(()=>{});
    }
  };
  if (!box) return;
  if (!_walletSessionReady && !_walletSessionPromise) refreshWalletSession();
  const wallets = loadWallets();
  let current = getCurrent();
  if (current && !wallets.some(wallet => wallet.addr.toLowerCase() === current.toLowerCase())) {
    setCurrent('');
    current = '';
  }
  const currentWallet = wallets.find(w => w.addr.toLowerCase() === (current || '').toLowerCase());
  const short = a => a ? a.slice(0,6) + '…' + a.slice(-4) : '';
  if (currentWallet) {
    const verified = _walletSession.verified && _walletSession.wallet === currentWallet.addr.toLowerCase();
    const checking = _verifyingAddress === currentWallet.addr.toLowerCase();
    box.innerHTML = `<div class="wallet-login connected"><span class="wallet-dot"></span><span class="wallet-addr" title="${currentWallet.addr}">${short(currentWallet.addr)}</span><span class="wallet-provider">${escapeWalletName(currentWallet.provider)}</span><span class="wallet-provider" style="color:${verified?'#0ecb81':'#f0b90b'}">${verified?'VERIFIED':'UNVERIFIED'}</span>${verified?'':`<button class="wallet-link" id="walletVerify" ${checking?'disabled':''}>${checking?'VERIFYING…':'Verify'}</button>`}<button class="wallet-link" id="walletManage">${t('top.manage')}</button><button class="wallet-link" id="walletDisconnect">${t('top.disconnect')}</button></div>`;
    document.querySelector('#walletVerify')?.addEventListener('click', () => verifyWallet(currentWallet.addr).catch(()=>{}));
    document.querySelector('#walletDisconnect')?.addEventListener('click', async () => { await logoutWalletSession(); setCurrent(''); renderWalletLogin(); });
    document.querySelector('#walletManage')?.addEventListener('click', () => openPanel(wallets, current));
    return;
  }
  box.innerHTML = `<button class="wallet-connect-btn" id="walletBtn">${t('top.connect')}</button>`;
  document.querySelector('#walletBtn')?.addEventListener('click', () => openPanel(wallets, current));
}

// AppKit \u6309\u9700\u52a0\u8f7d（2026-08-07 \u6027\u80fd\u4f18\u5316）：\u9996\u5c4f\u4e0d\u518d\u540c\u6b65\u52a0\u8f7d ~2.3MB \u7684 appkit.bundle.js，
// \u7528\u6237\u9996\u6b21\u70b9\u51fb「Connect Wallet」\u65f6\u624d\u52a8\u6001 import \u5e76\u521d\u59cb\u5316；Load failed\u81ea\u52a8\u56de\u9000\u672c\u5730Wallet\u9762\u677f。
let _appKitPromise = null;
function ensureAppKit() {
  if (window.__appkit) return Promise.resolve(window.__appkit);
  if (_appKitPromise) return _appKitPromise;
  _appKitPromise = import('/v2/libs/appkit.bundle.js')
    .then(async mod => {
      if (window.__appkit) return window.__appkit;
      const { createAppKit, mainnet, bsc, polygon, arbitrum, base } = mod;
      const appKit = createAppKit({
        projectId: '6dbe8e6e3ad0e1bad77a1376d24127b6',
        networks: [mainnet, bsc, polygon, arbitrum, base],
        metadata: {
          name: 'AITRACEROOT',
          description: 'AiTraceRoot V2 Demo - Trace the Root. Know the Risk.',
          url: location.origin,
          icons: ['/v2/favicon.svg']
        },
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent': '#08e7f7',
          '--w3m-color-mix': '#08e7f7',
          '--w3m-color-mix-strength': 12,
          '--w3m-font-family': 'Inter, sans-serif',
          '--w3m-background-color': '#0d1320',
          '--w3m-border-radius-master': '10px'
        },
        enableWalletConnect: true,
        enableEIP6963: false,
        allWallets: 'HIDE',
        features: { email: false, socials: false }
      });
      window.__appkit = appKit;
      appKit.subscribeWallet(state => {
        if (state && state.status === 'connected' && state.address && typeof window.__onAppKitConnect === 'function') {
          Promise.resolve(typeof appKit.getWalletProvider === 'function' ? appKit.getWalletProvider() : null)
            .catch(()=>null)
            .then(provider => window.__onAppKitConnect(state.address, state.caipNetwork ? state.caipNetwork.id : null, provider));
        } else if (state && state.status === 'disconnected') {
          logoutWalletSession().then(() => { setCurrent(''); renderWalletLogin(); });
        }
      });
      return appKit;
    })
    .catch(err => { _appKitPromise = null; throw err; });
  return _appKitPromise;
}

function openPanel(wallets, current) {
  let panel = document.querySelector('#walletPanel');
  if (panel) { panel.remove(); return; }
  const box = document.querySelector('#walletLogin');
  const short = a => a ? a.slice(0,6) + '…' + a.slice(-4) : '';
  panel = document.createElement('div');
  panel.id = 'walletPanel';
  panel.className = 'wallet-panel';
  panel.innerHTML = `
    <div class="wallet-panel-head">${t('wallet.manage')}</div>
    ${wallets.length ? `<div class="wallet-list">${wallets.map(w => `<div class="wallet-item ${w.addr.toLowerCase() === (current || '').toLowerCase() ? 'active' : ''}" data-use="${w.addr}"><span class="wo-dot" style="background:#0ecb81"></span><span class="wi-addr" title="${w.addr}">${short(w.addr)}</span><span class="wi-prov">${escapeWalletName(w.provider)}</span><button class="wi-del" data-del="${w.addr}" title="${t('wallet.delTitle')}">×</button></div>`).join('')}</div>` : ''}
    <div class="wallet-panel-head">${t('wallet.add')}</div>
    <div class="wallet-options">
      <button class="wallet-option" data-w="metamask"><span class="wo-dot" style="background:#f6851b"></span>${t('wallet.meta')}</button>
      <button class="wallet-option" data-w="okx"><span class="wo-dot" style="background:#ffffff"></span>${t('wallet.okx')}</button>
      <button class="wallet-option" data-w="trust"><span class="wo-dot" style="background:#3375bb"></span>${t('wallet.trust')}</button>
      <button class="wallet-option" data-w="binance"><span class="wo-dot" style="background:#f3ba2f"></span>${t('wallet.binance')}</button>
      <button class="wallet-option" data-w="coinbase"><span class="wo-dot" style="background:#0052ff"></span>${t('wallet.coinbase')}</button>
      <button class="wallet-option" id="walletAgg"><span class="wo-dot" style="background:#08e7f7"></span>${t('wallet.agg')}</button>
    </div>
    <p class="form-help" id="walletStatus">${t('wallet.help')}</p>`;
  box.appendChild(panel);
  panel.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => connectWallet(b.dataset.w)));
  panel.querySelector('#walletAgg')?.addEventListener('click', () => {
    if (window.__appkit) { window.__appkit.open(); return; }
    ensureAppKit().then(appKit => {
      if (appKit) appKit.open();
      else { const st = panel.querySelector('#walletStatus'); if (st) st.textContent = t('wallet.notfound'); }
    }).catch(() => { const st = panel.querySelector('#walletStatus'); if (st) st.textContent = t('wallet.notfound'); });
  });
  panel.querySelectorAll('[data-use]').forEach(r => r.addEventListener('click', async () => {
    const next = r.dataset.use;
    const changed = String(next).toLowerCase() !== String(current || '').toLowerCase();
    if (changed) await logoutWalletSession();
    setCurrent(next);
    renderWalletLogin();
    verifyWallet(next).catch(()=>{});
  }));
  panel.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    const removingCurrent = String(b.dataset.del).toLowerCase() === String(current || '').toLowerCase();
    if (removingCurrent) await logoutWalletSession();
    removeWallet(b.dataset.del);
    renderWalletLogin();
  }));
}

async function connectWallet(kind) {
  const status = document.querySelector('#walletStatus');
  const provider = walletProvider(kind);
  if (!provider) {
    if (status) status.textContent = t('wallet.noplugin');
    return;
  }
  if (status) status.textContent = t('wallet.waiting');
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts[0]) {
      addWallet(accounts[0], kind);
      rememberProvider(accounts[0], provider);
      renderWalletLogin();
      await verifyWallet(accounts[0], provider);
    } else if (status) status.textContent = t('wallet.noaccount');
  } catch (err) {
    if (status) status.textContent = t('wallet.fail') + (err && err.message ? err.message : t('wallet.cancel'));
  }
}

// AI market intelligence uses live backend metrics and an explicit offline state.
const _esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const _compactUsd = v => {
  if (v == null) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(Math.round(v));
};
const _dir = v => (v === 'BULLISH' ? 'up' : (v === 'BEARISH' ? 'down' : 'warn'));
const _levelStyle = l => l === 'HIGH'
  ? 'color:#f6465d;background:rgba(246,70,93,.12);border:1px solid rgba(246,70,93,.4)'
  : (l === 'MEDIUM' ? 'color:#f0b90b;background:rgba(240,185,11,.12);border:1px solid rgba(240,185,11,.4)'
     : 'color:#0ecb81;background:rgba(14,203,129,.12);border:1px solid rgba(14,203,129,.4)');

function paintAIRail(box, ai) {
  const score = ai.score ?? 50;
  const trend = ai.trend || 'NEUTRAL';
  const vol = ai.volatility || 'MEDIUM';
  const mom = ai.momentum || 'NEUTRAL';
  const level = ai.risk_level || 'LOW';
  const hasHan = value => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(String(value || ''));
  const label = hasHan(ai.label) ? 'Derivatives sentiment based on positioning, funding and liquidations' : (ai.label || 'Live derivatives market intelligence');
  const safeNotes = (ai.risk_notes || []).filter(note => !hasHan(note)).slice(0, 2);
  const notes = (safeNotes.length ? safeNotes : ['No extreme market risk signals detected.']).map(_esc).join('<br>');
  const ind = ai.indicators || {};
  const fg = ind.fear_greed != null ? Math.round(ind.fear_greed) : '—';
  const ratio = ind.global_long_short_ratio != null ? Number(ind.global_long_short_ratio).toFixed(2) : '—';
  const funding = ind.funding_rate_median != null ? (Number(ind.funding_rate_median) * 100).toFixed(4) + '%' : '—';
  const ts = ai.updated_at ? new Date(ai.updated_at * 1000).toLocaleTimeString('en-US', {hour12: false}) : '';
  const srcTag = (ai.stale ? 'STALE · ' : '') + (ai.source || '');
  box.innerHTML = `
  <div class="ai-card"><div class="ai-card-head">✦ <b>AI MARKET INTELLIGENCE</b><span style="margin-left:auto;font-size:9px;color:#0ecb81;border:1px solid rgba(14,203,129,.4);border-radius:4px;padding:1px 5px">LIVE</span></div>
    <div class="ai-card-body">
      <div class="ai-gauge"><div class="gauge-number">${score}</div><p><b>${trend}</b><br>${_esc(label)}</p></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:10px;font-size:10px;color:var(--text-2,#9aa4b2)">
        <span>Fear &amp; Greed</span><b style="text-align:right;color:var(--text-1,#e8edf4)">${fg}</b>
        <span>Long/Short</span><b style="text-align:right;color:var(--text-1,#e8edf4)">${ratio}</b>
        <span>Funding</span><b style="text-align:right;color:var(--text-1,#e8edf4)">${funding}</b>
        <span>Liq 24h</span><b style="text-align:right;color:var(--text-1,#e8edf4)">${_compactUsd(ind.liq_24h_usd)}</b>
      </div>
    </div></div>
  <div class="ai-card"><div class="ai-card-head">◈ <b>QUANT SIGNALS</b></div><div class="ai-card-body">
    <div class="signal-row"><span>${t('ai.trend')}</span><b class="${_dir(trend)}">${trend}</b></div>
    <div class="signal-row"><span>${t('ai.vol')}</span><b class="warn">${vol}</b></div>
    <div class="signal-row"><span>${t('ai.momentum')}</span><b class="${mom === 'HEATED' ? 'warn' : _dir(mom)}">${mom}</b></div>
  </div></div>
  <div class="ai-card"><div class="ai-card-head">⚠ <b>RISK MONITOR</b><span style="margin-left:auto;font-size:9px;padding:1px 5px;border-radius:4px;${_levelStyle(level)}">${level}</span></div>
    <div class="ai-card-body"><p style="font-size:10px;color:var(--text-2,#9aa4b2);line-height:1.6;margin:0">${notes}</p><p style="font-size:9px;color:var(--text-3,#6b7482);margin:6px 0 0">${_esc(srcTag)} · ${ts}</p></div></div>`;
}

function paintAIRailOffline(box) {
  box.innerHTML = `<div class="ai-card"><div class="ai-card-head">✦ <b>AI MARKET INTELLIGENCE</b><span style="margin-left:auto;font-size:9px;color:#f6465d;border:1px solid rgba(246,70,93,.4);border-radius:4px;padding:1px 5px">OFFLINE</span></div><div class="ai-card-body"><p style="font-size:10px;color:var(--text-2,#9aa4b2);line-height:1.6;margin:0">Live signal unavailable. Will retry on next render.</p></div></div>`;
}

// 2026-08-11 \u4fee\u590d（\u67e5\u6e05\u6e05\u5355 #6）：\u524d\u7aef 30s \u8282\u6d41，\u907f\u514d\u88ab 5s refresh \u9891\u7e41\u8c03\u7528\u65f6\u91cd\u590d\u8bf7\u6c42 /api/ai/market（\u540e\u7aef\u5df2\u6709 45s \u7f13\u5b58）
let _railLastT = 0;
let _railCache = null;
let _railRequest = null;
let _railTimer = null;
let _railInterval = Math.max(60000, Number(localStorage.getItem('atr-ai-refresh')) || 60000);

function scheduleAIRail() {
  clearInterval(_railTimer);
  _railTimer=setInterval(()=>renderAIRail(true),_railInterval);
}

function bindAIRailControls(box) {
  if(!box.querySelector('.ai-rail-toolbar')){
    box.insertAdjacentHTML('afterbegin',`<div class="ai-rail-toolbar"><div><b>LIVE DATA</b><span id="aiRailUpdated">Auto refresh active</span></div><select class="ai-rail-interval" id="aiRailInterval" aria-label="AI data refresh interval"><option value="60000">1 min</option><option value="180000">3 min</option><option value="300000">5 min</option><option value="600000">10 min</option></select><button class="ai-rail-refresh" id="aiRailRefresh" type="button" aria-label="Refresh AI market data">↻ Refresh</button></div>`);
  }
  const select=box.querySelector('#aiRailInterval');
  if(select){select.value=String(_railInterval);select.onchange=()=>{_railInterval=Math.max(60000,Number(select.value)||60000);localStorage.setItem('atr-ai-refresh',String(_railInterval));scheduleAIRail()}}
  const stamp=box.querySelector('#aiRailUpdated');
  if(stamp)stamp.textContent=`Updated ${new Date().toLocaleTimeString('en-US',{hour12:false})}`;
  const button=box.querySelector('#aiRailRefresh');
  if(button)button.onclick=async()=>{button.disabled=true;button.classList.add('refreshing');await renderAIRail(true);button.disabled=false;button.classList.remove('refreshing')};
}

export function renderAIRail(force=false) {
  const box = document.querySelector('#aiRail');
  if (!box) return;
  if(_railCache){paintAIRail(box,_railCache);bindAIRailControls(box)}
  const now = Date.now();
  if (!force && now - _railLastT < 30000) return;
  if(_railRequest)return _railRequest;
  _railLastT = now;
  _railRequest=api.aiMarket().then(ai => {
    _railCache=ai;
    const cur = document.querySelector('#aiRail');
    if (cur){paintAIRail(cur, ai);bindAIRailControls(cur)}
  }).catch(() => {
    const cur = document.querySelector('#aiRail');
    if (cur){paintAIRailOffline(cur);bindAIRailControls(cur)}
  }).finally(()=>{_railRequest=null});
  scheduleAIRail();
  return _railRequest;
}
