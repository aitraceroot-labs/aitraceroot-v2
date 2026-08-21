import {LOCAL_TOKEN_LOGOS} from '../data/market-token-assets.js';

const PLACEHOLDER_IDS=new Set(['5Kc2PwwPkyvRXC8wHgkVfKwxrMGktRuDpwTgAy1bpump-solana','6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump-solana','AA3VLt3muGJiXedDaMnkcst3pfjrg1JBxgHVSdSbpump-solana','EjD5Y9NVhXmtEqU7wYvAyZvDWZFQeEuHXFatJmTbpump-solana','G1ij1UjWBcUFtVHz5GVDAopPNMQcbwtdegH94LU6Jray-solana','GCa9TZMK9Q3VUSkhZgX76YAQBjqQd1dPxkBnZojFpump-solana','gF6kXDUPivpk7VkqSBKfamxdyKzQPfjj4vXW2U8pump-solana']);
const aliases=chain=>chain==='sol'?['sol','solana']:chain==='solana'?['solana','sol']:[chain];

export function tokenAvatar(token,chain,symbol=''){
  const address=String(token||'').trim();
  const network=String(chain||'').toLowerCase().trim();
  const keys=aliases(network).flatMap(value=>[`${address}-${value}`,`${String(symbol||'').toUpperCase()}-${value}`]);
  if(network==='market'||!network)keys.push(`${String(symbol||address).toUpperCase()}-market`);
  const key=keys.find(id=>LOCAL_TOKEN_LOGOS[id]&&!PLACEHOLDER_IDS.has(id)&&!LOCAL_TOKEN_LOGOS[id].endsWith('/default-token.svg'));
  return key?LOCAL_TOKEN_LOGOS[key]:'';
}

export function withTokenAvatar(item){
  if(!item)return null;
  const avatar=tokenAvatar(item.token||item.contract||item.address,item.chain,item.symbol);
  return avatar?{...item,logo:avatar,avatar_url:avatar}:null;
}

export const visibleTokens=items=>(Array.isArray(items)?items:[]).map(withTokenAvatar).filter(Boolean);

export function hideOnAvatarError(event){
  const row=event.currentTarget?.closest('[data-token-row],tr,.mkt-card');
  if(row)row.hidden=true;
}
