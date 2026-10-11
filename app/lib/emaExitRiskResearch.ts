import { analyzeEmaCrossovers } from "./emaCrossoverBacktest.ts";
import type { EmaCandle, EmaCrossoverSignal } from "./emaCrossoverBacktest.ts";
import { bollingerEntryAllowed } from "./emaSignalComparison.ts";
import { inPhase, regimeAtBuySignal, studyEmaStock } from "./emaRegimeResearch.ts";
import type { EmaStudyInput, EmaStudyPhase } from "./emaRegimeResearch.ts";
import { riskStatistics } from "./emaStage5Research.ts";
import type { TaggedTrade } from "./emaStage5Research.ts";

/**
 * Research-only, fixed, non-optimized exit rules for stage-5 strategy #3.
 * Entry: EMA9 up-cross + BB20 + rising MA75 at signal close, buy next bar open.
 * No new entry until the next eligible EMA up-cross after an exit.
 */
export const EMA_EXIT_IDS = ["EMA", "STOP", "TAKE", "TIME"] as const;
export type EmaExitId = typeof EMA_EXIT_IDS[number];
export const EMA_EXIT_RULES: Record<EmaExitId, { label: string; desc: string }> = {
  EMA: { label: "① ③の従来売り", desc: "EMA9がEMA21を下抜け、翌営業日始値で売却" },
  STOP: { label: "② −7%損切り", desc: "EMA売りに加え、買値から7%下落でストップ売却" },
  TAKE: { label: "③ ＋15%利確", desc: "EMA売りに加え、買値から15%上昇で利益確定" },
  TIME: { label: "④ 最長20営業日", desc: "EMA売りに加え、保有20営業日後の翌始値で売却" },
};
export const EMA_EXIT_STOP_RATIO = 0.07;
export const EMA_EXIT_TAKE_RATIO = 0.15;
export const EMA_EXIT_MAX_HOLD_BARS = 20;
export const EMA_EXIT_COST_OPTIONS = [0, 0.0015] as const;

export type EmaExitTrade = TaggedTrade & {
  reason: EmaExitId;
  grossPnlYen: number;
  frictionYen: number;
};
type Position = { entryIndex: number; entryPrice: number; entryTime: number; signalTime: number };
type EmaExitPosition = { entryTime:number; entryPrice:number; unrealizedGrossYen:number; signalToExitPending:boolean };

const round = (v:number)=>Number(v.toFixed(2));

export function simulateEmaExits(
  code:string,
  candles:EmaCandle[],
  rule:EmaExitId,
  costPerSide:number = 0.0015,
) {
  if(!EMA_EXIT_IDS.includes(rule) || !EMA_EXIT_COST_OPTIONS.includes(costPerSide as 0|0.0015)) {
    throw Error("INVALID_EXIT_RULE_OR_COST");
  }
  const events = new Map(analyzeEmaCrossovers(candles).signals.map((s)=>[s.index,s]));
  const feature = (index:number) => {
    const regime = regimeAtBuySignal(candles,index);
    return bollingerEntryAllowed(candles,index) && regime.trend==="UP";
  };
  const trades:EmaExitTrade[]=[];
  let active:Position|null=null;
  let pending:EmaCrossoverSignal|null=null;

  function exit(position:Position, bar:EmaCandle, i:number, price:number, reason:EmaExitId, exitSignalTime:number) {
    const gross=(price-position.entryPrice)*100;
    const friction=(position.entryPrice+price)*100*costPerSide;
    const net=round(gross-friction);
    const entryNotional=position.entryPrice*100;
    trades.push({
      code, buySignalTime:position.signalTime,
      entryTime:position.entryTime, sellSignalTime:exitSignalTime,
      exitTime:bar.time, entryPrice:position.entryPrice, exitPrice:price,
      shares:100, pnlYen:net,
      returnPercent:round(100*net/entryNotional),
      holdBars:i-position.entryIndex,
      grossPnlYen:round(gross), frictionYen:round(friction), reason,
    });
  }

  for(let i=0;i<candles.length;i++){
    const bar=candles[i];
    // Orders based on yesterday's completed EMA signal fill at TODAY's open.
    if(pending?.kind==="SELL" && active){
      exit(active,bar,i,bar.open,"EMA",pending.time);
      active=null;
    } else if(pending?.kind==="BUY" && !active){
      active={entryIndex:i,entryPrice:bar.open,entryTime:bar.time,signalTime:pending.time};
    }
    pending=null;

    if(active && rule==="TIME" && i-active.entryIndex>=EMA_EXIT_MAX_HOLD_BARS){
      // Order known at prior close, exits at today's open; no favorable close lookahead.
      exit(active,bar,i,bar.open,"TIME",candles[i-1]?.time??bar.time);
      active=null;
    }

    // Observe complete current daily high/low after the open; stop has priority
    // if both thresholds were touched and intraday sequence is unknowable.
    if(active && (rule==="STOP" || rule==="TAKE")){
      const stop=active.entryPrice*(1-EMA_EXIT_STOP_RATIO);
      const target=active.entryPrice*(1+EMA_EXIT_TAKE_RATIO);
      if(rule==="STOP" && (bar.open<=stop || bar.low<=stop)){
        const price=bar.open<=stop?bar.open:stop;
        exit(active,bar,i,price,"STOP",bar.time);
        active=null;
      } else if(rule==="TAKE" && (bar.open>=target || bar.high>=target)){
        const price=bar.open>=target?bar.open:target;
        exit(active,bar,i,price,"TAKE",bar.time);
        active=null;
      }
    }

    // Do not reenter merely because a risk exit fired: wait for a fresh
    // EMA buy cross that independently satisfies the signal-day filter.
    const today=events.get(i);
    if(today?.kind==="BUY" && !active && feature(i)) pending=today;
    if(today?.kind==="SELL" && active) pending=today;
  }

  const latest=candles.at(-1);
  const open:EmaExitPosition|null=active && latest?{
    entryTime:active.entryTime,entryPrice:active.entryPrice,
    unrealizedGrossYen:round((latest.close-active.entryPrice)*100),
    signalToExitPending:pending?.kind==="SELL",
  }:null;

  return {trades,open,pendingBuy:pending?.kind==="BUY"};
}

export type ExitStockResearch={
  code:string;
  reason:string|null;
  candles:number;
  trades:Record<EmaExitId,EmaExitTrade[]>;
  open:Record<EmaExitId,boolean>;
};
export function analyzeExitStock(input:EmaStudyInput,costPerSide:number=0.0015):ExitStockResearch{
  const quality=studyEmaStock(input);
  // Invalid OHLC bars must be excluded before using high/low for stop/target hits.
  const malformed=input.candles.some((bar)=>
    !Number.isFinite(bar.high)||!Number.isFinite(bar.low)||bar.low<=0||
    bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close)||
    bar.high<bar.low);
  const reason=quality.reason || (malformed?"日足の高値・安値が不正":null);
  const values=reason?null:Object.fromEntries(EMA_EXIT_IDS.map((id)=>[
    id,simulateEmaExits(input.code,input.candles,id,costPerSide),
  ])) as Record<EmaExitId,ReturnType<typeof simulateEmaExits>>;
  return {
    code:input.code,reason,candles:input.candles.length,
    trades:Object.fromEntries(EMA_EXIT_IDS.map(id=>[id,values?.[id].trades??[]])) as Record<EmaExitId,EmaExitTrade[]>,
    open:Object.fromEntries(EMA_EXIT_IDS.map(id=>[id,!!values?.[id].open])) as Record<EmaExitId,boolean>,
  };
}

export function exitResearchSummary(inputs:EmaStudyInput[],phase:EmaStudyPhase,costPerSide=0.0015){
  const stocks=inputs.map((input)=>analyzeExitStock(input,costPerSide));
  const eligible=stocks.filter((stock)=>!stock.reason);
  const summaries=Object.fromEntries(EMA_EXIT_IDS.map((id)=>{
    const selected=eligible.flatMap((stock)=>stock.trades[id].filter((trade)=>inPhase(trade,phase)));
    const stats=riskStatistics(selected);
    const byStock=eligible.map((stock)=>{
      const t=stock.trades[id].filter((trade)=>inPhase(trade,phase));
      return {code:stock.code,stats:riskStatistics(t),trades:t};
    });
    const ranked=[...byStock].filter((x)=>x.stats.trades>0).sort((a,b)=>b.stats.totalPnlYen-a.stats.totalPnlYen);
    const best=ranked[0]??null;
    const reasons=Object.fromEntries(EMA_EXIT_IDS.map((reason)=>[reason,selected.filter(t=>t.reason===reason).length])) as Record<EmaExitId,number>;
    return [id,{
      stats,byStock,reasons,
      tradedStocks:byStock.filter((x)=>x.stats.trades>0).length,
      maximumContributor:best?.code??null,
      excludingMaximumContributorYen:best?round(stats.totalPnlYen-best.stats.totalPnlYen):null,
      totalFrictionYen:round(selected.reduce((s,t)=>s+t.frictionYen,0)),
      openPositions:eligible.filter((stock)=>stock.open[id]).length,
    }];
  })) as Record<EmaExitId,{
    stats:ReturnType<typeof riskStatistics>;
    byStock:Array<{code:string;stats:ReturnType<typeof riskStatistics>;trades:EmaExitTrade[]}>;
    reasons:Record<EmaExitId,number>;
    tradedStocks:number;maximumContributor:string|null;excludingMaximumContributorYen:number|null;
    totalFrictionYen:number;openPositions:number;
  }>;
  return {stocks,eligible:eligible.length,excluded:stocks.length-eligible.length,summaries};
}
