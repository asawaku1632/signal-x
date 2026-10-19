/** Owner-only, read-only prior-night watch.
 * The ranking is based solely on the prior session's stored AI score.
 * No outcome data is allowed to alter the order or choose candidates.
 */
import {ENTRY_TIME_SLOTS, jstParts, selectPriorDayCandidates} from "./entryTimeShadow.mjs";

export const NIGHT_MORNING_POLICY = "PRIOR_NIGHT_TOP5_0905_CLOSE_V1";
export const NIGHT_MORNING_MIN_SAMPLES = 30;
export const NIGHT_MORNING_MIN_DAYS = 10;
const ONE_DAY_MS = 86_400_000;
const BANDS = ["85–89","90–94","95–100"];

function shiftDate(day, offset) {
  const stamp=Date.parse(day+"T00:00:00Z");
  if(!Number.isFinite(stamp)) throw Error("INVALID_DATE");
  return new Date(stamp+offset*ONE_DAY_MS).toISOString().slice(0,10);
}

/** The night switches at 18:00 JST, after normal daily-result saving.
 * Prior to that (including the next morning), show the same previous
 * session snapshot. Do not silently use an older day when data is missing.
 */
export function nightMorningTradingDates(now, isTradingDate) {
  if(typeof isTradingDate!=="function") throw Error("CALENDAR_REQUIRED");
  const jst=jstParts(now);
  let sourceDate=null;
  if(isTradingDate(jst.date)&&jst.minute>=18*60) sourceDate=jst.date;
  if(!sourceDate) {
    for(let i=1;i<=14;i++){
      const day=shiftDate(jst.date,-i);
      if(isTradingDate(day)){sourceDate=day;break;}
    }
  }
  if(!sourceDate) throw Error("SOURCE_TRADING_DATE_NOT_FOUND");
  let tradeDate=null;
  for(let i=1;i<=14;i++){
    const day=shiftDate(sourceDate,i);
    if(isTradingDate(day)){tradeDate=day;break;}
  }
  if(!tradeDate) throw Error("NEXT_TRADING_DATE_NOT_FOUND");
  return {sourceDate,tradeDate};
}

export function scoreBand(score){
  const n=Number(score);
  if(!Number.isFinite(n)||n<85||n>100)return null;
  if(n<90)return BANDS[0];
  if(n<95)return BANDS[1];
  return BANDS[2];
}

function validEarlyResult(row, date) {
  if(!row||row.complete!==true||row.date!==date||
    !Array.isArray(row.entries)||!ENTRY_TIME_SLOTS.every(slot=>
      row.entries.some(entry=>entry.time===slot&&Number.isFinite(entry.entryPrice)&&Number.isFinite(entry.pnl100)))){
    return null;
  }
  const score=Number(row.priorScore);
  const bucket=scoreBand(score);
  const early=row.entries.find(entry=>entry.time==="09:05");
  return bucket && Number.isFinite(early?.pnl100)?
    {bucket,pnl100:early.pnl100,code:String(row.code??"")}:null;
}

/** Outcomes are ONLY for descriptive historical evidence.
 * Future/same-day rows are excluded. Repeated records for one stock-day
 * are counted at most once. A small sample has no asserted win probability.
 */
export function summarizeNightMorningEvidence(runs, targetTradeDate){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(targetTradeDate))throw Error("INVALID_TRADE_DATE");
  const data=new Map(BANDS.map(b=>[b,{band:b,count:0,wins:0,days:new Set(),pnl:0}]));
  const dedupe=new Set();
  for(const run of Array.isArray(runs)?runs:[]){
    const date=String(run?.trade_date??"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=targetTradeDate||!Array.isArray(run?.results))continue;
    for(const row of run.results) {
      const r=validEarlyResult(row,date);
      if(!r || !/^[0-9]{4}$/.test(r.code))continue;
      const key=date+":"+r.code;
      if(dedupe.has(key))continue;
      dedupe.add(key);
      const b=data.get(r.bucket);
      b.count++;b.wins+=Number(r.pnl100>0);b.pnl+=r.pnl100;b.days.add(date);
    }
  }
  return BANDS.map(band=>{
    const b=data.get(band);
    const days=b.days.size;
    const sufficient=b.count>=NIGHT_MORNING_MIN_SAMPLES&&days>=NIGHT_MORNING_MIN_DAYS;
    return {band,count:b.count,wins:b.wins,days,sufficient,
      observedPositiveRate:sufficient?100*b.wins/b.count:null,
      avgPnl100:sufficient?b.pnl/b.count:null};
  });
}

export function buildNightMorningCandidates(savedSignals){
  // Fixed selection rule re-used by the existing entry-time study.
  // No historical results, current-day AI or later quotes may enter this ranking.
  return selectPriorDayCandidates(Array.isArray(savedSignals)?savedSignals:[])
    .map(row=>({...row,band:scoreBand(row.score)}));
}
