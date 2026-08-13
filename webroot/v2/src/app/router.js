export const routes = [
  {path:'/v2/', key:'dashboard', label:'nav.dashboard', icon:'dashboard', group:'TERMINAL'},
  {path:'/v2/markets', key:'markets', label:'nav.markets', icon:'markets', group:'TERMINAL'},
  {path:'/v2/radar', key:'radar', label:'nav.radar', icon:'radar', group:'TERMINAL'},
  {path:'/v2/futures', key:'futures', label:'nav.futures', icon:'futures', group:'TERMINAL'},
  {path:'/v2/smartmoney', key:'smartmoney', label:'nav.smartmoney', icon:'smartmoney', group:'TERMINAL'},
  {path:'/v2/alpha', key:'alpha', label:'nav.alpha', icon:'radar', group:'INTELLIGENCE'},
  {path:'/v2/risk', key:'risk', label:'nav.risk', icon:'risk', group:'INTELLIGENCE'},
  {path:'/v2/strategies', key:'follow', label:'nav.follow', icon:'follow', group:'INTELLIGENCE'},
  {path:'/v2/chat', key:'chat', label:'nav.chat', icon:'chat', group:'INTELLIGENCE'},
  {path:'/v2/user', key:'user', label:'nav.user', icon:'user', group:'ACCOUNT'},
  {path:'/v2/admin/ai-whitelist', key:'aiWhitelist', label:'nav.aiWhitelist', icon:'risk', group:'ACCOUNT', hidden:true},
];

export function matchRoute(path = location.pathname) {
  if (path.startsWith('/v2/token/')) return {key:'token', path, label:'nav.token'};
  if (path === '/v2/follow') {
    history.replaceState({}, '', '/v2/strategies');
    return routes.find(route => route.path === '/v2/strategies');
  }
  if (path === '/v2/wallet') {
    history.replaceState({}, '', '/v2/smartmoney');
    return routes.find(route => route.path === '/v2/smartmoney');
  }
  return routes.find(route => route.path === path) || routes[0];
}

export function navigate(path) {
  if (location.pathname === path) return;
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}
