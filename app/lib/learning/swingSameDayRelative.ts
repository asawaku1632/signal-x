/** Read-only, same-date relative study of the existing whole-universe archive.
 * NEVER interpret this as Nikkei/TOPIX performance or a simulated fill.
 * Each eligible signal date has equal weight to avoid large-day domination.
 * Null future prices never become zero-return observations.
 */
export const SAME_DAY_RELATIVE_VERSION="AI_ONLY_4_BANDS_SAME_DAY_90D_V1";
export const SAME_DAY_MIN_FULL_UNIVERSE=800;
export const SAME_DAY_MIN_COVERAGE=0.8;
export const SAME_DAY_MIN_GROUP_OBS=5;
export const SAME_DAY_MIN_CONCLUSIVE_DAYS=10;
export const SAME_DAY_BANDS=[
  {key:"0-19",label:"AI 0〜19"},
  {key:"20-39",label:"AI 20〜39"},
  {key:"40-54",label:"AI 40〜54"},
  {key:"55-64",label:"AI 55〜64"},
] as const;
export const SAME_DAY_PEERS=[
  {key:"CANDIDATE",label:"スイング候補"},
  {key:"WAIT",label:"押し目待ち"},
  {key:"WATCH",label:"様子見"},
] as const;
export const SAME_DAY_HORIZONS=[1,3,5,10] as const;

export type SameDaySource={
  trade_date:string;days:number;group_key:string;recorded:string;
  checked:string;up_count:string;avg_return:string|null;
};
type Parsed={tradeDate:string;days:number;groupKey:string;recorded:number;
  checked:number;up:number;mean:number|null};
export type SameDayDaily={
  date:string;count:number;bandMeanPct:number;universeMeanPct:number;
  excessPctPoints:number;bandUpRate:number;universeUpRate:number;
};
export type SameDayPeer={
  groupKey:string;label:string;matchedDates:number;peerMeanPct:number|null;
  excessPctPoints:number|null;
};
export type SameDaySummary={
  band:string;label:string;days:number;matchedDates:number;stockDays:number;
  universeStockDays:number;bandMeanPct:number|null;
  universeMeanPct:number|null;excessPctPoints:number|null;
  bandUpRate:number|null;universeUpRate:number|null;
  beatUniverseDays:number;conclusive:boolean;
  peers:SameDayPeer[];daily:SameDayDaily[];
};
const numeric=(value:unknown)=>{
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const average=(nums:number[]):number|null=>
  nums.length?nums.reduce((sum,n)=>sum+n,0)/nums.length:null;
const rounded=(value:number|null)=>
  value===null?null:Number(value.toFixed(3));
const eligible=(r:Parsed|undefined,universe=false)=>
  !!r && r.recorded >= (universe?SAME_DAY_MIN_FULL_UNIVERSE:SAME_DAY_MIN_GROUP_OBS) &&
  r.checked>=Math.ceil(r.recorded*SAME_DAY_MIN_COVERAGE) &&
  r.checked>0 && r.mean!==null;

export function summarizeSameDayRelative(raw:SameDaySource[]):SameDaySummary[]{
  const index=new Map<string,Parsed>();
  for(const row of Array.isArray(raw)?raw:[]){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.trade_date)||
      !SAME_DAY_HORIZONS.some(x=>x===Number(row.days)))continue;
    const recorded=numeric(row.recorded),checked=numeric(row.checked),
      up=numeric(row.up_count),mean=numeric(row.avg_return);
    if(recorded===null||checked===null||up===null||
      ![recorded,checked,up].every(Number.isInteger)||
      recorded<0||checked<0||up<0||up>checked||checked>recorded)continue;
    const key=row.trade_date+":"+row.days+":"+row.group_key;
    if(index.has(key))continue;
    index.set(key,{tradeDate:row.trade_date,days:Number(row.days),
      groupKey:row.group_key,recorded,checked,up,mean});
  }
  const dates=[...new Set([...index.values()].map(r=>r.tradeDate))].sort();
  const lookup=(date:string,days:number,group:string)=>index.get(date+":"+days+":"+group);
  return SAME_DAY_BANDS.flatMap(band=>SAME_DAY_HORIZONS.map(days=>{
    const matched=dates.flatMap(date=>{
      const universe=lookup(date,days,"ALL"),target=lookup(date,days,band.key);
      if(!eligible(universe,true)||!eligible(target))return [];
      return [{date,universe:universe!,target:target!}];
    });
    const daily=matched.map(({date,universe,target}):SameDayDaily=>({
      date,count:target.checked,
      bandMeanPct:target.mean!,universeMeanPct:universe.mean!,
      excessPctPoints:target.mean!-universe.mean!,
      bandUpRate:100*target.up/target.checked,
      universeUpRate:100*universe.up/universe.checked,
    }));
    const means=matched.map(({target})=>target.mean!);
    const market=matched.map(({universe})=>universe.mean!);
    return {
      band:band.key,label:band.label,days,matchedDates:matched.length,
      stockDays:matched.reduce((a,x)=>a+x.target.checked,0),
      universeStockDays:matched.reduce((a,x)=>a+x.universe.checked,0),
      bandMeanPct:rounded(average(means)),
      universeMeanPct:rounded(average(market)),
      excessPctPoints:rounded(average(daily.map(x=>x.excessPctPoints))),
      bandUpRate:rounded(average(daily.map(x=>x.bandUpRate))),
      universeUpRate:rounded(average(daily.map(x=>x.universeUpRate))),
      beatUniverseDays:daily.filter(x=>x.excessPctPoints>0).length,
      conclusive:matched.length>=SAME_DAY_MIN_CONCLUSIVE_DAYS,
      peers:SAME_DAY_PEERS.map(peer=>{
        const paired=matched.flatMap(({date,target})=>{
          const p=lookup(date,days,peer.key);
          return eligible(p)?[{targetMean:target.mean!,peerMean:p!.mean!}]:[];
        });
        return {groupKey:peer.key,label:peer.label,matchedDates:paired.length,
          peerMeanPct:rounded(average(paired.map(x=>x.peerMean))),
          excessPctPoints:rounded(average(paired.map(x=>x.targetMean-x.peerMean)))};
      }),
      daily:daily.slice().reverse().map(d=>({...d,
        bandMeanPct:Number(d.bandMeanPct.toFixed(3)),
        universeMeanPct:Number(d.universeMeanPct.toFixed(3)),
        excessPctPoints:Number(d.excessPctPoints.toFixed(3)),
        bandUpRate:Number(d.bandUpRate.toFixed(2)),
        universeUpRate:Number(d.universeUpRate.toFixed(2))})),
    };
  }));
}
