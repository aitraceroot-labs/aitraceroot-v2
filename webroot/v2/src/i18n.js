const COPY={
  'nav.dashboard':'Intelligence Terminal','nav.markets':'Markets','nav.futures':'Futures','nav.alpha':'Alpha Radar',
  'nav.radar':'On-Chain Radar','nav.risk':'Risk Alert','nav.follow':'Strategy Center','nav.chat':'AI Chat',
  'nav.smartmoney':'Smart Money','nav.user':'Account Center','nav.aiWhitelist':'AI Whitelist','nav.token':'Token Terminal',
  'top.status':'Market Live','top.connect':'Connect Wallet','top.manage':'Manage','top.disconnect':'Disconnect',
  'wallet.manage':'Wallet Manager','wallet.add':'Add Wallet','wallet.agg':'WalletConnect',
  'wallet.meta':'MetaMask','wallet.okx':'OKX Wallet','wallet.trust':'Trust Wallet',
  'wallet.binance':'Binance Wallet','wallet.coinbase':'Coinbase Wallet',
  'wallet.help':'Select a wallet and approve the connection request to continue.',
  'wallet.notfound':'The wallet connection module is unavailable. Refresh and try again.',
  'wallet.noplugin':'The selected wallet was not detected. Install its extension or use WalletConnect.',
  'wallet.waiting':'Waiting for wallet approval…','wallet.noaccount':'The wallet returned no account.',
  'wallet.fail':'Connection failed: ','wallet.cancel':'The request was cancelled or the wallet returned an error.',
  'wallet.delTitle':'Delete','side.engine':'Data Engine','side.mode':'Single Admin Mode','side.brandSub':'V2 TERMINAL',
  'ai.marketStatus':'Market: Neutral-Bullish','ai.marketDesc':'Price and capital-flow signals are aggregated live.',
  'ai.trend':'Trend Strength','ai.vol':'Volatility Risk','ai.momentum':'Momentum',
  'ai.riskDesc':'Risk monitoring combines open interest, funding, crowding and liquidation intensity.'
};

export const getLang=()=> 'en';
export function setLang(){if(typeof document!=='undefined')document.documentElement.lang='en';return'en'}
export const t=key=>COPY[key]||key;
export const onChangeLang=()=>{};
export const toggleLang=()=>setLang();
export const applyZh=()=>{};
export function registerZhObserver(){setLang()}
