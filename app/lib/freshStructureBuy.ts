import {detectOwnerStructureBreaks,type PatternCandle} from "@/app/lib/chartPatternEngine";
import {evaluateFreshBuy} from "@/app/lib/freshBuyEvent.mjs";
export function evaluateFreshBuyWithStructures(input:PatternCandle[],nowMs:number,tradeDate:string){
 const base=evaluateFreshBuy(input,nowMs,tradeDate);
 if(typeof base.price!=="number"||!Array.isArray(base.signals)||!Array.isArray(base.candles))return base;
 if(!(base.movePercent>0&&base.movePercent<=3&&base.extensionPercent<=5&&base.volumeRatio>=1.3))return base;
 const bars=input.filter(b=>Number.isFinite(b.time)&&b.time*1000+300000<=nowMs).sort((a,b)=>a.time-b.time).slice(-150);
 if(bars.some(b=>![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.open<=0||b.close<=0||b.low<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume!<0))return base;
 const last=bars.at(-1)!;
 const middle=bars.slice(-20).reduce((s,b)=>s+b.close,0)/20;
 const priorMiddle=bars.slice(-21,-1).reduce((s,b)=>s+b.close,0)/20;
 if(last.close<=middle||middle<=priorMiddle)return base;
 const previous=new Set(detectOwnerStructureBreaks(bars.slice(0,-1)).map(p=>p.name));
 const fresh=detectOwnerStructureBreaks(bars).filter(p=>!previous.has(p.name)).map(p=>({
  kind:"STRUCTURE_"+p.id,label:p.name+"の新規上抜け",level:p.level,volumeRatio:base.volumeRatio,
  points:p.points,reasons:p.reasons,engineName:p.name
 }));
 if(!fresh.length)return base;
 return {...base,matched:true,reason:"NEW_BUY_CONDITIONS",version:"FRESH_BUY_V2_STRUCTURES",
  signals:[...base.signals,...fresh],candles:bars};
}
