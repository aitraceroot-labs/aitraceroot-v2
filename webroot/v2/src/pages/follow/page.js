import {api} from '../../services/api.js';
import {escapeHTML} from '../../utils/format.js';
import {renderAIRail} from '../../layouts/terminal-layout.js';
import {asArray,asObject,isMounted} from '../../utils/safe.js';

const FALLBACK=[
  {strategy_id:'strategy_a',name:'Strategy A',subtitle:'Multi-Factor Market Signal',version:'2.0.0',description:'Multi-source market, derivatives, flow, liquidity and risk consensus engine.',official:true,verified:true,publisher:'AITRACEROOT'},
  {strategy_id:'strategy_b',name:'Strategy B',subtitle:'Short-Term Futures Momentum',version:'0.7.1',description:'Short-horizon futures momentum, taker flow, OI, funding, crowding and liquidation engine.',official:true,verified:true,publisher:'AITRACEROOT'},
];

const strategyName=strategy=>strategy.name||strategy.strategy_name_en||strategy.strategy_name||strategy.strategy_id||'Official Strategy';
const strategyVersion=strategy=>strategy.version||strategy.strategy_version||'';

function officialCard(strategy,index){
  const official=Boolean(strategy.official??true);
  const verified=Boolean(strategy.verified??official);
  return `<article class="ab-strategy-card strategy-official-static ${index===0?'active':''}">
    <span class="strategy-card-top">${official?'<i class="strategy-official-badge">AITRACEROOT OFFICIAL</i>':''}${verified?'<i class="strategy-verified-badge">✓ VERIFIED</i>':''}</span>
    <span class="strategy-card-name">${escapeHTML(strategyName(strategy))}</span>
    <b>${escapeHTML(strategy.subtitle||'Quantitative Strategy Signal')}</b>
    <em>v${escapeHTML(strategyVersion(strategy))}</em>
    <p>${escapeHTML(strategy.description||'Live quantitative strategy analysis.')}</p>
    <small>Publisher · ${escapeHTML(strategy.publisher||'AITRACEROOT')}</small>
  </article>`;
}

export async function renderFollow(root){
  let strategies=FALLBACK;
  try{
    const output=asObject(await api.strategies());
    if(asArray(output.strategies).length){
      strategies=output.strategies.map(strategy=>({
        ...strategy,
        official:Boolean(strategy.official??true),
        verified:Boolean(strategy.verified??strategy.official??true),
        publisher:strategy.publisher||'AITRACEROOT',
      }));
    }
  }catch{}
  if(!isMounted(root))return;
  root.innerHTML=`<div class="page-head strategy-center-head"><div><h1>Strategy Center</h1><p>OFFICIAL QUANT STRATEGIES · PRIVATE FACTOR WORKSPACE · READ-ONLY SIGNALS</p></div><div class="page-actions"><span class="status-live">● STRATEGY ENGINE ONLINE</span><button class="terminal-btn strategy-upload-disabled" type="button" disabled title="Community strategy uploads are not open yet">UPLOAD STRATEGY <small>COMING SOON</small></button></div></div>
    <div class="strategy-coming-soon"><span>COMMUNITY STRATEGIES</span><b>Publishing is not open yet</b><p>More creators will be able to submit strategies after security review and sandbox infrastructure are ready.</p></div>
    <section class="strategy-library strategy-library-only"><div class="strategy-section-head"><div><span>OFFICIAL LIBRARY</span><h2>AITRACEROOT VERIFIED STRATEGIES</h2></div><small>${strategies.length} LIVE STRATEGIES</small></div><div class="ab-strategy-grid">${strategies.map(officialCard).join('')}</div></section>`;
  renderAIRail();
}
