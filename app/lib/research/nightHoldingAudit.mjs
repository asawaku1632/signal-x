/**
 * Chronological, embargoed train/holdout audit for 1/3/5-day periods.
 * Training decisions are frozen before looking at holdout outcomes.
 * Descriptive research only: NEVER an individualized future recommendation.
 */
import {scoreGroup} from "./nightHoldingGuidance.mjs";

export const MIN_TRAIN_STOCK_DAYS=30;
export const MIN_TRAIN_SESSIONS=10;
export const MIN_TEST_STOCK_DAYS=15;
export const MIN_TEST_SESSIONS=5;
const HORIZONS=[1,3,5];
const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const percentage=(row,h)=>(row.exits[h]-row.entries["09:05"])/row.entries["09:05"]*100;

function metrics(rows){
  return HORIZONS.map(h=>{
    const changes=rows.map(row=>percentage(row,h));
    return {horizon:h,count:changes.length,
      meanPct:changes.length?changes.reduce((s,n)=>s+n,0)/changes.length:null,
      positiveRate:changes.length?100*changes.filter(n=>n>0).length/changes.length:null};
  });
}

/** Always select on chronological TRAINING data only. Keep a 5-day outcome
 * embargo so a training observation must have matured before first test date.
 * Assumes targetDates[5] was computed by exchange business calendar.
 */
export function auditHoldingPeriods(rows,asOfDate,score){
  const band=scoreGroup(score);
  const empty={band,ready:false,reason:"INSUFFICIENT_HISTORY",trainCount:0,testCount:0,
    trainDays:0,testDays:0,chosen:null,train:[],holdout:[],reproduced:null};
  if(!band||!/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate)))return {...empty,reason:"INVALID_TARGET"};
  const seen=new Set();
  const eligible=[];
  for(const row of Array.isArray(rows)?rows:[]){
    if(typeof row?.date!=="string"||row.date>=asOfDate||
      scoreGroup(row.score)!==band||!/^\d{4}$/.test(String(row.code)))continue;
    const unique=row.date+":"+row.code;
    if(seen.has(unique))continue;
    if(!valid(row.entries?.["09:05"])||!HORIZONS.every(h=>valid(row.exits?.[h])))continue;
    if(typeof row.targetDates?.[5]!=="string"||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.targetDates[5])||
      row.targetDates[5]>=asOfDate)continue;
    seen.add(unique);
    eligible.push(row);
  }
  const dates=[...new Set(eligible.map(r=>r.date))].sort();
  if(dates.length<MIN_TRAIN_SESSIONS+MIN_TEST_SESSIONS)return {...empty,reason:"INSUFFICIENT_SESSIONS"};
  // Last 1/3 of sessions form untouched holdout. Explicitly embargo training
  // labels that mature on/after the start of the holdout period.
  const testStart=dates[Math.floor(dates.length*2/3)];
  const train=eligible.filter(r=>r.date<testStart&&r.targetDates[5]<testStart);
  const test=eligible.filter(r=>r.date>=testStart);
  const trainDays=new Set(train.map(r=>r.date)).size;
  const testDays=new Set(test.map(r=>r.date)).size;
  const stats={...empty,trainCount:train.length,testCount:test.length,trainDays,testDays};
  if(train.length<MIN_TRAIN_STOCK_DAYS||trainDays<MIN_TRAIN_SESSIONS||
    test.length<MIN_TEST_STOCK_DAYS||testDays<MIN_TEST_SESSIONS)return stats;
  const trainStats=metrics(train);
  const testStats=metrics(test);
  // Find the training winner ONCE. Never re-select using test outcomes.
  const chosen=[...trainStats].sort((a,b)=>b.meanPct-a.meanPct||a.horizon-b.horizon)[0].horizon;
  const holdoutWinner=[...testStats].sort((a,b)=>b.meanPct-a.meanPct||a.horizon-b.horizon)[0].horizon;
  return {...stats,ready:true,reason:"VALIDATED_SPLIT",chosen,train:trainStats,
    holdout:testStats,reproduced:chosen===holdoutWinner,
    trainLastDate:train.map(x=>x.date).sort().at(-1),testFirstDate:testStart};
}
