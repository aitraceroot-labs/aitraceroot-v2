import {asArray, asObject} from '../utils/safe.js';

const DEFAULT_TIMEOUT = 15000;
let tradingCSRF = '';
let walletCSRF = '';
let aitraAdminCSRF = '';
try{walletCSRF=sessionStorage.getItem('atr-wallet-csrf')||''}catch{}

const rememberWalletCSRF=value=>{
  walletCSRF=String(value||'');
  try{if(walletCSRF)sessionStorage.setItem('atr-wallet-csrf',walletCSRF);else sessionStorage.removeItem('atr-wallet-csrf')}catch{}
};

const normalizeFields=(value,arrayFields=[],objectFields=[])=>{
  const data=asObject(value);
  arrayFields.forEach(key=>{data[key]=asArray(data[key]).map(asObject)});
  objectFields.forEach(key=>{data[key]=asObject(data[key])});
  return data;
};
const dataArrayEnvelope=value=>{const out=asObject(value);out.data=asArray(out.data).map(asObject);return out};
const dataObjectEnvelope=value=>{const out=asObject(value);out.data=asObject(out.data);return out};

export async function request(path, options = {}) {
  const method=(options.method||'GET').toUpperCase();
  if(path.startsWith('/api/trading/') && path!=='/api/trading/session' && !['GET','HEAD','OPTIONS'].includes(method) && !tradingCSRF){
    const auth=await request('/api/trading/session');tradingCSRF=auth.data?.csrf_token||'';
  }
  if(path.startsWith('/api/admin/aitra/')&&path!=='/api/admin/aitra/session'&&!['GET','HEAD','OPTIONS'].includes(method)&&!aitraAdminCSRF){
    const auth=await request('/api/admin/aitra/session');aitraAdminCSRF=auth.csrf_token||'';
  }
  const controller = options.controller || new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  try {
    const {controller: _externalController, ...fetchOptions}=options;
    const response = await fetch(path, {
      credentials: 'same-origin', cache: 'no-store', ...fetchOptions, signal: controller.signal,
      headers: options.body ? {'Content-Type':'application/json', ...(tradingCSRF?{'X-CSRF-Token':tradingCSRF}:{}), ...(walletCSRF&&!['GET','HEAD','OPTIONS'].includes(method)?{'X-Wallet-CSRF':walletCSRF}:{}), ...(aitraAdminCSRF&&!['GET','HEAD','OPTIONS'].includes(method)?{'X-AITRA-Admin-CSRF':aitraAdminCSRF}:{}), ...(options.headers || {})} : {...(tradingCSRF&&!['GET','HEAD','OPTIONS'].includes(method)?{'X-CSRF-Token':tradingCSRF}:{}),...(walletCSRF&&!['GET','HEAD','OPTIONS'].includes(method)?{'X-Wallet-CSRF':walletCSRF}:{}),...(aitraAdminCSRF&&!['GET','HEAD','OPTIONS'].includes(method)?{'X-AITRA-Admin-CSRF':aitraAdminCSRF}:{}),...(options.headers||{})},
    });
    const data = await response.json().catch(() => ({}));
    const payload = asObject(data);
    if (!response.ok) throw new Error((typeof payload.error==='object'?payload.error?.message:payload.error) || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(options.controller?'Request cancelled.':'Request timed out. Please try again later.');
    if (error instanceof TypeError) throw new Error('Network connection failed. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function marketTop() {
  const data = asObject(await request('/api/watchboard', {timeout: 20000}));
  const coins = asArray(data.coins).map((item, index) => {
    const coin=asObject(item);
    return ({
    rank: index + 1,
    symbol: String(coin.symbol || coin.label || coin.token || '').replace(/USDT$|USDC$/i, '').toUpperCase(),
    name: coin.name || coin.label || coin.symbol || coin.token || '',
    logo: coin.logo || '',
    price: coin.price_usd,
    change_24h: coin.price_change_24h,
    volume_24h: coin.volume_24h ?? coin.binance_volume_24h,
    market_cap: coin.market_cap ?? null,
    net_flow: coin.net_flow ?? null,
    long_short_ratio: coin.long_short_ratio ?? null,
    open_interest: coin.open_interest ?? null,
    funding_rate: coin.funding_rate ?? null,
    liquidations_24h: coin.liquidations_24h ?? null,
    ai_score: coin.ai_score ?? 50,
    chain: coin.chain || '',
    onchain: !!coin.onchain,
    token: coin.token || '',
    liquidity_usd: coin.liquidity_usd ?? null,
    });
  });
  return {coins, updated_at: data.updated_at, source: 'Market and derivatives data'};
}

export const api = {
  watchboard: async () => {
    const out=normalizeFields(await request('/api/watchboard', {timeout: 20000}),['coins']);
    out.coins=out.coins.filter(coin=>String(coin.symbol||coin.label||'').trim());
    return out;
  },
  marketTop,
  marketOverview: async () => normalizeFields(await request('/api/market-overview', {timeout:30000}),[],['global']),
  aiMarket: () => request('/api/ai/market', {timeout:12000}),
  systemHealth: () => request('/api/system/health', {timeout:10000}),
  priceLive: (symbols=[]) => request('/api/price/live?symbols='+encodeURIComponent(asArray(symbols).join(',')), {timeout:8000}),
  chainOverview: () => request('/api/chain/overview', {timeout:10000}),
  radarProjects: (sort='new',chain='',q='',force=false) => request(`/api/radar/projects?sort=${encodeURIComponent(sort)}${chain?`&chain=${encodeURIComponent(chain)}`:''}${q?`&q=${encodeURIComponent(q)}`:''}${force?'&refresh=1':''}`, {timeout:20000}),
  onchainProfile: (chain,token,refresh=false) => request(`/api/onchain/profile?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}${refresh?'&refresh=1':''}`, {timeout:45000}),
  onchainHolders: (chain,token,limit=50) => request(`/api/onchain/holders?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}&limit=${limit}`, {timeout:30000}),
  onchainPools: (chain,token) => request(`/api/onchain/pools?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {timeout:20000}),
  onchainTrades: (chain,token,limit=50) => request(`/api/onchain/trades?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}&limit=${limit}`, {timeout:20000}),
  onchainWalletLabels: (chain,address='') => request(`/api/onchain/wallet-labels?chain=${encodeURIComponent(chain)}${address?`&address=${encodeURIComponent(address)}`:''}`, {timeout:10000}),
  onchainWalletLabelSet: body => request('/api/onchain/wallet-labels', {method:'POST',body:JSON.stringify(body),timeout:10000}),
  tokenTrades: (chain, token) => request(`/api/token/trades?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {timeout:15000}),
  signals: async () => normalizeFields(await request('/api/signals'),['coins']),
  alpha: async () => normalizeFields(await request('/api/alpha', {timeout: 30000}),['events','candidates','watchlist']),
  moneyFlow: () => request('/api/money-flow?window_h=24'),
  futuresLive: async symbol => {
    const out=dataObjectEnvelope(await request(`/api/futures/live?symbol=${encodeURIComponent(symbol)}&window=60`));
    out.data.open_interest=asObject(out.data.open_interest);out.data.book=asObject(out.data.book);out.data.trade_flow=asObject(out.data.trade_flow);out.data.liquidations=asObject(out.data.liquidations);out.data.long_short=asObject(out.data.long_short);out.data.long_short.global_accounts=asObject(out.data.long_short.global_accounts);out.data.long_short.top_positions=asObject(out.data.long_short.top_positions);out.data.anomaly_radar=asObject(out.data.anomaly_radar);out.data.anomaly_radar.alerts=asArray(out.data.anomaly_radar.alerts).map(asObject);
    return out;
  },
  coinglassTerminal: async symbol => {
    const out=asObject(await request(`/api/coinglass/terminal?symbol=${encodeURIComponent(symbol)}`, {timeout:30000}));
    out.liquidation=asObject(out.liquidation);out.global_long_short=asObject(out.global_long_short);out.top_position_long_short=asObject(out.top_position_long_short);out.top_account_ratio=asObject(out.top_account_ratio);
    out.oi_exchange=asArray(out.oi_exchange).map(asObject);out.oi_history=asArray(out.oi_history).map(asObject);out.funding_exchange=asArray(out.funding_exchange).map(asObject);out.liquidation_history=asArray(out.liquidation_history).map(asObject);out.etf_flow=asArray(out.etf_flow).map(asObject);
    out.fear_greed=asObject(out.fear_greed);
    return out;
  },
  kline: async (symbol, tf='hour', limit=300, token='', chain='') => {let qs=`symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=${limit}`;if(token)qs+=`&token=${encodeURIComponent(token)}`;if(chain)qs+=`&chain=${encodeURIComponent(chain)}`;return normalizeFields(await request(`/api/kline?${qs}`, {timeout:30000}),['candles'])},
  signal: (token, chain) => request(`/api/signal?token=${encodeURIComponent(token)}&chain=${chain}`),
  tokenSnapshot: (chain, token) => request(`/api/monitor?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {timeout:4000}),
  alphaCheck: (chain, token, symbol='') => request(`/api/alpha/check?chain=${encodeURIComponent(chain||'')}&token=${encodeURIComponent(token||'')}&symbol=${encodeURIComponent(symbol)}`, {timeout:15000}),
  alphaTokens: () => request('/api/alpha/tokens', {timeout:20000}),
  marketsQualified: (minMcap=15000000, limit=150) => request(`/api/markets/qualified?min_mcap=${minMcap}&limit=${limit}`, {timeout:20000}),
  gmgnHolders: (chain, token, limit=20) => request(`/api/gmgn/holders?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}&limit=${limit}`, {timeout:15000}),
  holderStats: (chain, token) => request(`/api/token/holder-stats?chain=${encodeURIComponent(chain||'bsc')}&token=${encodeURIComponent(token||'')}`, {timeout:15000}),
  gmgnKline: (chain, token, resolution='1h') => request(`/api/gmgn/kline?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}&resolution=${encodeURIComponent(resolution)}`, {timeout:15000}),
  gmgnPool: (chain, token) => request(`/api/gmgn/pool?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {timeout:15000}),
  gmgnSecurity: (chain, token) => request(`/api/gmgn/security?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {timeout:15000}),
  gmgnSmartMoney: (chain='sol', limit=20) => request(`/api/gmgn/smartmoney?chain=${encodeURIComponent(chain)}&limit=${limit}`, {timeout:15000}),
  walletProfile: address => request(`/api/wallet/profile?address=${encodeURIComponent(address)}`, {timeout:20000}),
  smartWallets: () => request('/api/smart-wallets', {timeout:10000}),
  smartWalletAdd: (address, chain='bsc', note='') => request('/api/smart-wallets', {method:'POST', body:JSON.stringify({address, chain, note}), timeout:10000}),
  smartWalletTag: (address, chain='bsc', note='') => request(`/api/smart-wallets/${encodeURIComponent(address)}/tag`, {method:'PUT', body:JSON.stringify({chain, note}), timeout:10000}),
  smartWalletDelete: address => request(`/api/smart-wallets/${encodeURIComponent(address)}`, {method:'DELETE', timeout:10000}),
  smartMoney: (limit=60) => request(`/api/smart/money?limit=${limit}`, {timeout:15000}),
  followList: () => request('/api/follow', {timeout:10000}),
  followAdd: (wallet, chain='bsc', note='', mode='all') => request('/api/follow', {method:'POST', body:JSON.stringify({wallet, chain, note, mode}), timeout:10000}),
  followDelete: wallet => request(`/api/follow/${encodeURIComponent(wallet)}`, {method:'DELETE', timeout:10000}),
  followToggle: wallet => request(`/api/follow/${encodeURIComponent(wallet)}/toggle`, {method:'POST', timeout:10000}),
  followSignals: (limit=60) => request(`/api/follow/signals?limit=${limit}`, {timeout:15000}),
  followLeaderboard: (limit=20) => request(`/api/follow/leaderboard?limit=${limit}`, {timeout:15000}),
  strategies: () => request('/api/strategies', {timeout:10000}),
  strategyCompute: body => request('/api/strategy/compute', {method:'POST', body:JSON.stringify(body), timeout:60000}),
  walletSession: async()=>{const out=asObject(await request('/api/wallet-auth/session',{timeout:10000}));rememberWalletCSRF(out.authenticated?out.csrf_token:'');return out},
  walletChallenge: address=>request('/api/wallet-auth/challenge',{method:'POST',body:JSON.stringify({address}),timeout:10000}),
  walletVerify: async(address,message,signature)=>{const out=asObject(await request('/api/wallet-auth/verify',{method:'POST',body:JSON.stringify({address,message,signature}),timeout:15000}));rememberWalletCSRF(out.csrf_token);return out},
  walletLogout: async()=>{const out=await request('/api/wallet-auth/session',{method:'DELETE',timeout:10000});rememberWalletCSRF('');return out},
  userProfile:()=>request('/api/user-vault/profile',{timeout:10000}),
  userProfileSave:profile=>request('/api/user-vault/profile',{method:'PUT',body:JSON.stringify(typeof profile==='string'?{ai_name:profile}:profile),timeout:10000}),
  userWatchlist:()=>request('/api/user-vault/watchlist',{timeout:10000}),
  userWatchlistSave:body=>request('/api/user-vault/watchlist',{method:'PUT',body:JSON.stringify(body),timeout:15000}),
  userStrategies:()=>request('/api/user-vault/strategies',{timeout:10000}),
  userStrategySave:body=>request('/api/user-vault/strategies',{method:'POST',body:JSON.stringify(body),timeout:10000}),
  userStrategyDelete:id=>request(`/api/user-vault/strategies/${encodeURIComponent(id)}`,{method:'DELETE',timeout:10000}),
  smartMoneySol: (limit=50) => request(`/api/smart-money/sol?limit=${limit}`, {timeout:15000}),
  smartMoneyStats: () => request('/api/smart-money/stats', {timeout:15000}),
  smartMoneyHolders: (chain, token) => request(`/api/smart-money/holders?chain=${encodeURIComponent(chain||'')}&token=${encodeURIComponent(token||'')}`, {timeout:15000}),
  smartMoneyTraders: (chain, token, limit=20) => request(`/api/smart-money/traders?chain=${encodeURIComponent(chain||'')}&token=${encodeURIComponent(token||'')}&limit=${limit}`, {timeout:15000}),
  smartMoneyStatus: () => request('/api/smart-money/status', {timeout:10000}),
  customTokens: () => request('/api/custom-tokens', {timeout:10000}),
  customTokenAdd: (token, chain='bsc', note='') => request('/api/custom-tokens', {method:'POST', body:JSON.stringify({token, chain, note}), timeout:10000}),
  customTokenDelete: (token, chain='bsc') => request(`/api/custom-tokens/${encodeURIComponent(token)}?chain=${encodeURIComponent(chain)}`, {method:'DELETE', timeout:10000}),
  riskAlerts: (limit=60) => request(`/api/risk/alerts?limit=${limit}`, {timeout:15000}),
  riskCoins: (limit=100) => request(`/api/risk/coins?limit=${limit}`, {timeout:15000}),
  riskAudit: (address, chain='') => request(`/api/risk/audit?address=${encodeURIComponent(address)}${chain?`&chain=${encodeURIComponent(chain)}`:''}`, {timeout:30000}),
  chainEvents: (token, limit=100) => request(`/api/chain/events?token=${encodeURIComponent(token)}&limit=${limit}`, {timeout:15000}),
  news: async () => ({items:[],sources:[]}),
  chat: (prompt, messages=[]) => request('/api/chat', {method:'POST', body:JSON.stringify({prompt,messages}), timeout:60000}),
  aitraStatus:()=>request('/api/aitra/status',{timeout:12000}),
  aitraAnalyze:(query,mode='assistant',intent='',request_id='',controller=null)=>request('/api/aitra/analyze',{method:'POST',body:JSON.stringify({query,mode,intent,request_id}),timeout:60000,...(controller?{controller}:{})}),
  aitraWhitelist:(query='')=>request(`/api/admin/aitra/whitelist${query?'?'+query:''}`),
  aitraWhitelistSave:body=>request('/api/admin/aitra/whitelist',{method:'POST',body:JSON.stringify(body)}),
  aitraWhitelistUpdate:(id,body)=>request(`/api/admin/aitra/whitelist/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  aitraWhitelistDelete:id=>request(`/api/admin/aitra/whitelist/${encodeURIComponent(id)}`,{method:'DELETE'}),
  aitraWhitelistAudit:()=>request('/api/admin/aitra/whitelist/audit'),
  me:()=>request('/auth/api/me'),login:(username,password)=>request('/auth/api/login',{method:'POST',body:JSON.stringify({username,password})}),register:(username,password)=>request('/auth/api/register',{method:'POST',body:JSON.stringify({username,password})}),logout:()=>request('/auth/api/logout',{method:'POST'}),updateProfile:(display_name,avatar)=>request('/auth/api/profile',{method:'POST',body:JSON.stringify({display_name,avatar})}),
};
