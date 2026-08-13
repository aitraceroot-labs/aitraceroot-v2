import {createChart, ColorType, CrosshairMode, LineStyle} from '../vendor/lightweight-charts.standalone.production.mjs';

function line(ctx, values, x, y, w, h, min, max, color, width=1.2) {
  if(!Array.isArray(values)||!values.length)return;ctx.beginPath();
  values.forEach((v,i)=>{const px=x+i/Math.max(1,values.length-1)*w,py=y+h-(v-min)/Math.max(max-min,1e-12)*h;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function sma(values, period){values=Array.isArray(values)?values:[];return values.map((_,i)=>i<period-1?null:values.slice(i-period+1,i+1).reduce((a,b)=>a+Number(b||0),0)/period)}
export function ema(values, period){values=Array.isArray(values)?values:[];const k=2/(period+1);let prev=Number(values[0])||0;return values.map((v,i)=>(prev=i?Number(v||0)*k+prev*(1-k):Number(v||0)))}
export function boll(values, period=20, mult=2){values=Array.isArray(values)?values:[];const mid=sma(values,period);return mid.map((m,i)=>{if(m==null)return null;const s=values.slice(i-period+1,i+1),sd=Math.sqrt(s.reduce((a,v)=>a+(Number(v||0)-m)**2,0)/period);return{mid:m,upper:m+sd*mult,lower:m-sd*mult}})}
export function rsi(values, period=14){values=Array.isArray(values)?values:[];let gains=0,losses=0;return values.map((v,i)=>{if(!i)return null;const d=Number(v||0)-Number(values[i-1]||0);gains=(gains*(period-1)+Math.max(d,0))/period;losses=(losses*(period-1)+Math.max(-d,0))/period;return i<period?null:100-100/(1+gains/Math.max(losses,1e-12))})}
/* MACD(12,26,9)：\u8fd4\u56de [ {dif,dea,hist} | null, ... ]（\u4e0e K \u7ebf\u5bf9\u9f50） */
export function macdSeries(values, fast=12, slow=26, signal=9){
  values=Array.isArray(values)?values:[];
  if(values.length<2)return [];
  const ef=ema(values,fast),es=ema(values,slow);
  const dif=values.map((_,i)=>ef[i]-es[i]);
  const dea=ema(dif,signal);
  return values.map((_,i)=>i<slow-1?null:{dif:dif[i],dea:dea[i],hist:(dif[i]-dea[i])*2});
}
/* KDJ(9,3,3)：\u8fd4\u56de [ {k,d,j} | null, ... ] */
export function kdjSeries(values, period=9, kSmooth=3, dSmooth=3){
  values=Array.isArray(values)?values:[];
  if(values.length<period)return [];
  let prevK=50,prevD=50;
  return values.map((v,i)=>{
    if(i<period-1)return null;
    const slice=values.slice(i-period+1,i+1);
    const hh=Math.max(...slice),ll=Math.min(...slice);
    const rsv=hh===ll?50:(Number(v)-ll)/(hh-ll)*100;
    const k=prevK=(prevK*(kSmooth-1)+rsv)/kSmooth;
    const d=prevD=(prevD*(dSmooth-1)+k)/dSmooth;
    return {k,d,j:3*k-2*d};
  });
}
/* \u8ba1\u7b97 KDJ \u7528\u7684 LLV/HHV \u53c2\u8003\u7ebf（None，\u4ec5\u4e0a\u9762\u51fd\u6570） */

/* ============================================================
   AITRACEROOT V2 · K \u7ebf\u5f15\u64ce（Lightweight Charts）
   2026-08-08 \u8fc1\u79fb\u81ea V1(aitraceroot.pro/#/kline) \u529f\u80fd\u5bf9\u9f50：
   - \u4e3b\u56fe：\u8721\u70db + Volume + MA7/25/60 + EMA7/25/60 + BOLL(20,2)
   - \u526f\u56fe：MACD(12,26,9) / RSI(14) / KDJ(9,3,3) \u4e09\u9009\u4e00
   - \u4ea4\u4e92：\u5341\u5b57\u7ebf + \u60ac\u6d6e OHLCV + Scroll to zoom + \u62d6\u62fd\u5e73\u79fb + \u81ea\u9002\u5e94\u5c3a\u5bf8
   - \u89c6\u89c9：TradingView \u6df1\u8272\u7cfb（#131722 \u5e95 / \u6da8 #26a69a / \u8dcc #ef5350），\u4e0e V1 \u4e00\u81f4
   ============================================================ */
const _inst=new WeakMap();
const _fmt=n=>{if(n==null||!Number.isFinite(Number(n)))return'—';const v=Number(n);return v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(2)+'K':(v<1&&v>0?v.toPrecision(4):v.toLocaleString('en-US',{maximumFractionDigits:2}))};
const _tfmt=t=>{if(!t)return'—';const d=new Date(t*1000);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const C_UP='#26a69a',C_DOWN='#ef5350',C_GRID='rgba(42,52,66,.5)',C_TEXT='#7c8aa0',C_BG='#131722';

function _mkSeries(chart,type,opts){return chart[type](opts)}

const PRICE_SCALE_W=64;          // \u4e3b\u56fe/\u526f\u56fe\u53f3\u4fa7Price\u8f74\u540c\u5bbd → Time\u8f74\u4e25\u683c\u5bf9\u9f50
const SUB_H=150;                 // \u526f\u56feHigh\u5ea6

function _create(canvas, legendEl){
  const wrap=canvas.parentElement||canvas;
  /* ⚠️ \u5360\u4f4d <canvas> \u53ea\u670d\u52a1\u4e8e 2D \u56de\u9000\u6e32\u67d3（drawTerminalChart）。
     \u5168\u5c40 CSS Yes `.chart-wrap canvas{width:100%;height:100%;display:block}`，
     Enable Lightweight Charts \u65f6\u82e5\u4e0d\u9690\u85cf\u5b83，\u5b83\u4f1a\u4ee5 100% High\u5ea6\u72ec\u5360 .chart-wrap，
     \u628a\u968f\u540e append \u7684\u771f\u5b9e\u56fe\u8868\u5bb9\u5668\u6574 Assets\u6324\u5230\u9762\u677f\u5e95\u90e8（2026-08-08 \u7ebf\u4e0a「K\u7ebf\u8dd1\u5230\u5e95\u90e8」\u4e8b\u6545\u6839\u56e0）。 */
  if(canvas!==wrap&&canvas.tagName==='CANVAS'){canvas.dataset.klineHidden='1';canvas.style.display='none'}
  const w=Math.max(300,wrap.clientWidth||600);
  const mainH=Math.max(260,wrap.clientHeight||380);
  /* \u526f\u56fe\u5bb9\u5668（MACD/RSI/KDJ）：\u4f18\u5148\u590d\u7528\u6a21\u677f\u5185\u5df2\u58f0\u660e\u7684 .kline-sub；
     \u6ca1\u6709\u5219\u52a8\u6001\u521b\u5efa\u5e76\u63d2\u5230\u4e3b\u56fe\u5bb9\u5668「\u7d27\u540e\u9762」（\u4e0d\u80fd append \u5230\u9762\u677f\u672b\u5c3e，No\u5219\u4f1a\u4e0e\u4e3b\u56fe\u9519\u4f4d\u91cd\u53e0）。*/
  const host=wrap.parentElement||wrap;
  let subWrap=host.querySelector('.kline-sub'),subChart=null;
  if(!subWrap){
    subWrap=document.createElement('div');
    subWrap.className='kline-sub';
    subWrap.style.cssText='height:0;overflow:hidden;transition:height .2s ease';
    if(wrap.insertAdjacentElement)wrap.insertAdjacentElement('afterend',subWrap);
    else host.appendChild(subWrap);
  }

  const _before=new Set(wrap.children);
  const chart=createChart(wrap,{
    width:w,height:mainH,
    layout:{background:{type:ColorType.Solid,color:C_BG},textColor:C_TEXT,fontSize:11,fontFamily:'monospace'},
    grid:{vertLines:{color:C_GRID},horzLines:{color:C_GRID}},
    crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'rgba(120,140,170,.55)',width:1,style:LineStyle.Dashed,labelBackgroundColor:'#243044'},horzLine:{color:'rgba(120,140,170,.55)',width:1,style:LineStyle.Dashed,labelBackgroundColor:'#243044'}},
    rightPriceScale:{borderColor:'rgba(28,38,54,1)',minimumWidth:PRICE_SCALE_W},
    timeScale:{borderColor:'rgba(28,38,54,1)',timeVisible:true,secondsVisible:false,rightOffset:4,barSpacing:8},
    localization:{locale:'en-US',priceFormatter:p=>_fmt(p)},
    handleScroll:{mouseWheel:true,pressedMouseMove:true},
    handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
  });
  /* \u56fe\u8868\u5bb9\u5668\u5f3a\u5236\u7f6e\u4e3a .chart-wrap \u7684Page \u4e00 Assets\u5b50\u8282\u70b9 → K\u7ebf\u6c38\u8fdc\u6e32\u67d3\u5728\u6700\u4e0a\u65b9 */
  const chartEl=[...wrap.children].find(c=>!_before.has(c));
  if(chartEl&&wrap.firstElementChild!==chartEl){try{wrap.insertBefore(chartEl,wrap.firstElementChild)}catch{}}

  const candle=chart.addCandlestickSeries({
    upColor:C_UP,downColor:C_DOWN,borderUpColor:C_UP,borderDownColor:C_DOWN,
    wickUpColor:C_UP,wickDownColor:C_DOWN,priceFormat:{type:'price',minMove:1e-12,precision:12},
  });
  const vol=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});
  /* \u4e3b\u56fe\u5185\u90e8\u7eb5\u5411\u5206\u533a：K\u7ebf\u5360\u4e0a\u65b9 ~70%，Volume\u8d34\u5e95 ~22%（\u660e\u786e\u4e0a\u4e0b\u987a\u5e8f，\u4e92\u4e0d\u906e\u6321） */
  try{candle.priceScale().applyOptions({scaleMargins:{top:0.06,bottom:0.28}})}
  catch{try{chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:0.28}})}catch{}}
  chart.priceScale('vol').applyOptions({scaleMargins:{top:0.78,bottom:0}});
  // MA / EMA / BOLL \u53e0\u52a0\u7ebf（\u521d\u59cb\u53ef\u89c1\u6027\u7531 indicators \u63a7\u5236）
  const maSeries=[[7,'#f4b728'],[25,'#4f8cff'],[60,'#a777ff']].map(([p,c])=>({p,c,series:chart.addLineSeries({color:c,lineWidth:1,lastValueVisible:false,priceLineVisible:false,visible:true,crosshairMarkerVisible:false})}));
  const emaSeries=[[7,'#e9c46a'],[25,'#4f8cff'],[60,'#e76f51']].map(([p,c])=>({p,c,series:chart.addLineSeries({color:c,lineWidth:1,lineStyle:LineStyle.Dashed,lastValueVisible:false,priceLineVisible:false,visible:true,crosshairMarkerVisible:false})}));
  const bollSeries=[['upper','#8ab6ff'],['mid','#a0aec0'],['lower','#8ab6ff']].map(([k,c])=>({k,c,series:chart.addLineSeries({color:c,lineWidth:1,lastValueVisible:false,priceLineVisible:false,visible:true,crosshairMarkerVisible:false})}));
  let priceLine=null,fitted=false;

  const inst={
    chart,candle,vol,maSeries,emaSeries,bollSeries,subWrap,priceLine:null,fitted:false,
    subChart:null,subSeries:null,
    indicators:{ma:true,ema:true,boll:true,macd:true,rsi:true,kdj:false},
    _subActive:null,
    /* \u6307\u6807\u5f00\u5173 */
    setIndicator(name,on){
      this.indicators[name]=!!on;
      if(name==='ma')maSeries.forEach(m=>m.series.applyOptions({visible:!!on}));
      else if(name==='ema')emaSeries.forEach(m=>m.series.applyOptions({visible:!!on}));
      else if(name==='boll')bollSeries.forEach(m=>m.series.applyOptions({visible:!!on}));
      else if(name==='macd'||name==='rsi'||name==='kdj'){this._subActive=on?name:(this._subActive===name?null:this._subActive);this._syncSub();}
    },
    _syncSub(){
      const on=this._subActive;
      if(subWrap)subWrap.style.height=(on?SUB_H:0)+'px';
      /* \u526f\u56fe\u6253\u5f00\u65f6\u7531\u526f\u56fe\u627f\u62c5Time\u8f74（TradingView \u540c\u6b3e：\u53ea\u6709\u6700\u5e95\u90e8\u56fe\u8868\u663e\u793aTime\u523b\u5ea6） */
      try{chart.applyOptions({timeScale:{visible:!on}})}catch{}
      if(!on){
        if(subChart){try{subChart.remove()}catch{}subChart=null;this.subChart=null;this.subSeries=null;this._subLookup=null;this._subAnchor=null}
        setTimeout(()=>{try{chart.applyOptions({width:Math.max(300,wrap.clientWidth||600),height:Math.max(260,wrap.clientHeight||380)})}catch{}},0);
        return;
      }
      if(!subChart){
        subChart=createChart(subWrap,{
          width:Math.max(300,wrap.clientWidth||600),height:SUB_H,
          layout:{background:{type:ColorType.Solid,color:C_BG},textColor:C_TEXT,fontSize:11,fontFamily:'monospace'},
          grid:{vertLines:{color:C_GRID},horzLines:{color:C_GRID}},
          timeScale:{visible:true,borderColor:'rgba(28,38,54,1)',timeVisible:true,secondsVisible:false,rightOffset:4,barSpacing:8},
          rightPriceScale:{borderColor:'rgba(28,38,54,1)',minimumWidth:PRICE_SCALE_W},
          crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'rgba(120,140,170,.55)',width:1,style:LineStyle.Dashed,labelBackgroundColor:'#243044'},horzLine:{color:'rgba(120,140,170,.55)',width:1,style:LineStyle.Dashed,labelBackgroundColor:'#243044'}},
          localization:{locale:'en-US'},
          handleScroll:{mouseWheel:true,pressedMouseMove:true},
          handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
        });
        this.subChart=subChart;
        this.subSeries=null;
        /* \u526f\u56fe → \u4e3b\u56fe：Time\u8f74\u7f29\u653e/\u5e73\u79fb\u53cc\u5411\u540c\u6b65 */
        try{subChart.timeScale().subscribeVisibleLogicalRangeChange(()=>this._syncRange('sub'))}catch{}
        /* \u526f\u56fe → \u4e3b\u56fe：\u5341\u5b57\u5149\u6807\u8054\u52a8 */
        try{subChart.subscribeCrosshairMove(p=>this._echoCrosshair(p,'sub'))}catch{}
      }
      if(this._lastCandles)this._drawSub(this._lastCandles);
      this._syncRange('main');
    },
    /* \u4e3b/\u526f\u56fe\u53ef\u89c6\u533a\u95f4\u540c\u6b65（\u5e26\u9632\u6296\u6807\u5fd7，\u907f\u514d\u4e92\u76f8\u89e6\u53d1\u6b7b\u5faa\u73af） */
    _syncRange(from){
      if(this._rangeLock||!subChart)return;
      this._rangeLock=true;
      try{
        const src=from==='sub'?subChart:chart, dst=from==='sub'?chart:subChart;
        const r=src.timeScale().getVisibleLogicalRange();
        if(r)dst.timeScale().setVisibleLogicalRange(r);
      }catch{}
      this._rangeLock=false;
    },
    /* \u4e3b/\u526f\u56fe\u5341\u5b57\u5149\u6807\u8054\u52a8 */
    _echoCrosshair(param,from){
      if(this._chLock)return;
      this._chLock=true;
      try{
        if(from==='main'){
          if(!subChart||!this._subAnchor)return;
          if(!param||!param.time){if(subChart.clearCrosshairPosition)subChart.clearCrosshairPosition()}
          else if(subChart.setCrosshairPosition){
            const v=this._subLookup?this._subLookup.get(Number(param.time)):null;
            subChart.setCrosshairPosition(v==null?0:v,param.time,this._subAnchor);
          }
        }else{
          if(!param||!param.time){if(chart.clearCrosshairPosition)chart.clearCrosshairPosition()}
          else if(chart.setCrosshairPosition){
            const v=this._candleLookup?this._candleLookup.get(Number(param.time)):null;
            if(v!=null)chart.setCrosshairPosition(v,param.time,candle);
          }
        }
      }catch{}
      this._chLock=false;
    },
    _drawSub(cs){
      if(!subChart)return;
      const type=this._subActive;const rows=Array.isArray(cs)?cs.filter(c=>c&&Number.isFinite(Number(c.close))):[];
      const times=rows.map(c=>Math.floor(Number(c.time)));
      const clean=v=>v.map((x,i)=>x==null?{time:times[i]}:{time:times[i],value:x}).filter(p=>p.value!=null);
      if(this.subSeries)this.subSeries.forEach(s=>{try{subChart.removeSeries(s)}catch{}});
      this.subSeries=[];
      this._subAnchor=null;this._subLookup=null;
      /* \u8bb0\u5f55\u8054\u52a8\u951a\u70b9（\u4f9b\u5341\u5b57\u5149\u6807\u540c\u6b65\u5b9a\u4f4d） */
      const anchor=(series,pts)=>{this._subAnchor=series;this._subLookup=new Map(pts.map(p=>[Number(p.time),p.value]))};
      const mk=(type,opts)=>{const s=subChart[type](opts);this.subSeries.push(s);return s};
      if(type==='macd'){
        const m=macdSeries(rows.map(c=>c.close));
        const hist=m.map((x,i)=>x?{time:times[i],value:x.hist,color:x.hist>=0?'rgba(38,166,154,.55)':'rgba(239,83,80,.55)'}:{time:times[i]}).filter(p=>p.value!=null);
        mk('addHistogramSeries',{priceFormat:{type:'price',precision:8}}).setData(hist);
        const difPts=clean(m.map(x=>x?x.dif:null));
        const difS=mk('addLineSeries',{color:'#e9c46a',lineWidth:1,lastValueVisible:false,priceLineVisible:false});difS.setData(difPts);
        mk('addLineSeries',{color:'#4f8cff',lineWidth:1,lastValueVisible:false,priceLineVisible:false}).setData(clean(m.map(x=>x?x.dea:null)));
        anchor(difS,difPts);
      }else if(type==='rsi'){
        const r=rsi(rows.map(c=>c.close),14);
        const s=mk('addLineSeries',{color:'#a777ff',lineWidth:1,lastValueVisible:false,priceLineVisible:false});
        const rPts=clean(r);s.setData(rPts);anchor(s,rPts);
        s.createPriceLine({price:70,color:'rgba(231,76,60,.5)',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:'70',axisLabelColor:'#243044',axisLabelTextColor:'#c9d4e4'});
        s.createPriceLine({price:30,color:'rgba(38,166,154,.5)',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:'30',axisLabelColor:'#243044',axisLabelTextColor:'#c9d4e4'});
      }else if(type==='kdj'){
        const kd=kdjSeries(rows.map(c=>c.close));
        const kPts=clean(kd.map(x=>x?x.k:null));
        const kS=mk('addLineSeries',{color:'#e9c46a',lineWidth:1,lastValueVisible:false,priceLineVisible:false});kS.setData(kPts);
        mk('addLineSeries',{color:'#4f8cff',lineWidth:1,lastValueVisible:false,priceLineVisible:false}).setData(clean(kd.map(x=>x?x.d:null)));
        mk('addLineSeries',{color:'#e76f51',lineWidth:1,lastValueVisible:false,priceLineVisible:false}).setData(clean(kd.map(x=>x?x.j:null)));
        anchor(kS,kPts);
      }
      this._syncRange('main');
    },
    update(cs,{showMA=true}={}){
      this._lastCandles=cs;
      const rows=Array.isArray(cs)?cs.filter(c=>c&&Number.isFinite(Number(c.close))):[];
      candle.setData(rows.map(c=>({time:Math.floor(Number(c.time)),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)})));
      this._candleLookup=new Map(rows.map(c=>[Math.floor(Number(c.time)),Number(c.close)]));   // \u4e3b\u56fe→\u526f\u56fe\u5341\u5b57\u7ebf\u8054\u52a8：\u6309 time \u67e5\u6536\u76d8\u4ef7
      const maxV=Math.max(...rows.map(c=>Number(c.volume)||0),1e-12);
      vol.setData(rows.map(c=>({time:Math.floor(Number(c.time)),value:Number(c.volume)||0,color:Number(c.close)>=Number(c.open)?'rgba(38,166,154,.5)':'rgba(239,83,80,.5)'})));
      const closes=rows.map(c=>c.close);
      maSeries.forEach(m=>{const vals=sma(closes,m.p);m.series.setData(rows.map((c,i)=>vals[i]!=null?{time:Math.floor(Number(c.time)),value:Number(vals[i])}:{time:Math.floor(Number(c.time))}).filter(p=>p.value!=null));m.series.applyOptions({visible:this.indicators.ma})});
      emaSeries.forEach(m=>{const vals=ema(closes,m.p);m.series.setData(rows.map((c,i)=>vals[i]!=null?{time:Math.floor(Number(c.time)),value:Number(vals[i])}:{time:Math.floor(Number(c.time))}).filter(p=>p.value!=null));m.series.applyOptions({visible:this.indicators.ema})});
      const bb=boll(closes,20,2);
      bollSeries.forEach(b=>{const vals=bb.map(x=>x?x[b.k]:null);b.series.setData(rows.map((c,i)=>vals[i]!=null?{time:Math.floor(Number(c.time)),value:Number(vals[i])}:{time:Math.floor(Number(c.time))}).filter(p=>p.value!=null));b.series.applyOptions({visible:this.indicators.boll})});
      if(this._subActive)this._drawSub(cs);
      if(rows.length){
        const last=rows.at(-1);
        if(!inst.priceLine){inst.priceLine=candle.createPriceLine({price:Number(last.close),color:'rgba(104,116,136,.65)',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:'',axisLabelColor:'#243044',axisLabelTextColor:'#c9d4e4'});}
        else inst.priceLine.applyOptions({price:Number(last.close)});
        if(!inst.fitted){chart.timeScale().fitContent();inst.fitted=true}
      }
    },
    dispose(){chart.remove();if(subChart)subChart.remove();_inst.delete(canvas)},
  };
  // \u81ea\u9002\u5e94\u5bb9\u5668\u5c3a\u5bf8（\u6ce8\u610f：\u672c\u73af\u5883 vendor \u4e3a\u5b9a\u5236\u7248\u5e93，chart.width()/height() \u65b9\u6cd5\u7f3a\u5931，\u7528 options() \u8de8\u7248\u672c\u517c\u5bb9）
  if(typeof ResizeObserver==='function'){
    try{const ro=new ResizeObserver(()=>{const ww=Math.max(300,wrap.clientWidth),hh=Math.max(300,wrap.clientHeight);const opt=chart.options()||{};if(ww!==opt.width||hh!==opt.height)chart.applyOptions({width:ww,height:hh});if(subChart){const so=subChart.options()||{};if(so.width!==ww)subChart.applyOptions({width:ww})}});ro.observe(wrap);inst.ro=ro}catch{}
  }
  // \u60ac\u6d6e OHLCV（\u5341\u5b57\u7ebf\u8054\u52a8）
  if(legendEl){
    chart.subscribeCrosshairMove(param=>{
      if(!param||!param.time){legendEl.textContent='—';inst._echoCrosshair(param,'main');return}
      const d=param.seriesData.get(candle);
      const v=param.seriesData.get(vol);
      if(d)legendEl.textContent=`${_tfmt(param.time)} · O ${_fmt(d.open)} H ${_fmt(d.high)} L ${_fmt(d.low)} C ${_fmt(d.close)} · V ${_fmt(v?v.value:null)}`;
      else legendEl.textContent=_tfmt(param.time);
      inst._echoCrosshair(param,'main');   // \u4e3b\u56fe\u5341\u5b57\u7ebf\u8054\u52a8 → \u526f\u56fe
    });
  }
  return inst;
}

export function drawTradingChart(canvas,candles,{showMA=true,legendEl=null,indicators=null}={}){
  if(!canvas)return null;
  if(typeof createChart!=='function'){drawTerminalChart(canvas,candles);return null}
  let inst=_inst.get(canvas);
  if(!inst){inst=_create(canvas,legendEl);_inst.set(canvas,inst)}
  if(indicators&&typeof indicators==='object'){for(const k in indicators)inst.setIndicator(k,indicators[k]);}
  inst.update(candles,{showMA});
  return {setData:cs=>inst.update(cs,{showMA}),setIndicator:(n,on)=>inst.setIndicator(n,on),remove:()=>{if(inst.ro)inst.ro.disconnect();inst.dispose()}};
}
export function disposeTradingChart(canvas){const i=_inst.get(canvas);if(i){if(i.ro)i.ro.disconnect();i.dispose()}}

/* ============================================================
   \u9759\u6001\u8721\u70db\u56fe（\u5e93Load failed\u65f6\u7684\u56de\u9000\u5b9e\u73b0）
   ============================================================ */
export function drawTerminalChart(canvas,candles,{showMA=true,showBoll=true,showVolume=true}={}){
  if(!canvas||typeof canvas.getContext!=='function')return;candles=Array.isArray(candles)?candles:[];const dpr=devicePixelRatio||1,box=canvas.getBoundingClientRect();
  const boxW=Math.max(300,box.width),boxH=Math.max(240,box.height);
  if(canvas.dataset.lastW!==String(boxW)||canvas.dataset.lastH!==String(boxH)){canvas.width=boxW*dpr;canvas.height=boxH*dpr;canvas.dataset.lastW=String(boxW);canvas.dataset.lastH=String(boxH)}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);const W=boxW,H=boxH,p={l:8,r:58,t:16,b:24};ctx.clearRect(0,0,W,H);ctx.fillStyle=C_BG;ctx.fillRect(0,0,W,H);if(!candles.length){ctx.fillStyle='#687488';ctx.fillText('NO KLINE DATA',W/2-40,H/2);return}
  const rows=candles.slice(-120).filter(c=>c&&['open','high','low','close'].every(key=>Number.isFinite(Number(c[key]))));if(!rows.length){ctx.fillStyle='#687488';ctx.fillText('NO VALID KLINE DATA',W/2-50,H/2);return}const high=Math.max(...rows.map(c=>Number(c.high))),low=Math.min(...rows.map(c=>Number(c.low))),range=Math.max(high-low,1e-12),cw=(W-p.l-p.r)/rows.length;
  const volH=showVolume?Math.max(36,Math.round((H-p.t-p.b)*0.18)):0,vTop=H-p.b-volH,mh=vTop-p.t;
  ctx.strokeStyle='#17202c';ctx.lineWidth=1;for(let i=0;i<5;i++){const yy=p.t+i*mh/4;ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillStyle='#687488';ctx.font='9px monospace';ctx.fillText((high-i*range/4).toPrecision(6),W-p.r+5,yy+3)}
  rows.forEach((c,i)=>{const x=p.l+i*cw+cw/2,yo=p.t+(high-c.open)/range*mh,yc=p.t+(high-c.close)/range*mh,yh=p.t+(high-c.high)/range*mh,yl=p.t+(high-c.low)/range*mh,color=c.close>=c.open?C_UP:C_DOWN;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,yh);ctx.lineTo(x,yl);ctx.stroke();ctx.fillStyle=color;ctx.fillRect(x-Math.max(1,cw*.28),Math.min(yo,yc),Math.max(2,cw*.56),Math.max(1,Math.abs(yc-yo))) });
  const closes=rows.map(c=>c.close),x=p.l,y=p.t,w=W-p.l-p.r,h=mh;if(showMA){for(const [period,color] of [[7,'#f4b728'],[25,'#4f8cff'],[60,'#a777ff']]){const vals=sma(closes,period),clean=vals.map((v,i)=>v??closes[i]);line(ctx,clean,x,y,w,h,low,high,color)}}if(showBoll){const b=boll(closes),up=b.map((v,i)=>v?.upper??closes[i]),lo=b.map((v,i)=>v?.lower??closes[i]);line(ctx,up,x,y,w,h,low,high,'rgba(36,200,219,.6)',.8);line(ctx,lo,x,y,w,h,low,high,'rgba(36,200,219,.6)',.8)}
  if(showVolume){
    const vols=rows.map(c=>Number(c.volume)||0),maxV=Math.max(...vols,1e-12),sumV=vols.reduce((a,b)=>a+b,0);
    rows.forEach((c,i)=>{const vh=vols[i]/maxV*(volH-4);ctx.fillStyle=c.close>=c.open?'rgba(38,166,154,.4)':'rgba(239,83,80,.4)';ctx.fillRect(p.l+i*cw+Math.max(0,(cw-cw*.6)/2),vTop+volH-vh,Math.max(1,cw*.6),vh)});
    ctx.strokeStyle='#1a2430';ctx.beginPath();ctx.moveTo(p.l,vTop);ctx.lineTo(W-p.r,vTop);ctx.stroke();
    ctx.fillStyle='#687488';ctx.font='9px monospace';ctx.fillText('VOL '+_fmt(sumV),p.l+4,H-p.b+3);
  }
}
