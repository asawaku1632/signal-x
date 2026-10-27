/**
 * Offline chronological holdout validation for verified forward outcomes.
 * The cutoff must be chosen before inspecting holdout results.
 * Embargo uses session indexes to reduce overlap between forward windows.
 * Descriptive only: not evidence of causality or statistical significance.
 */
import { DEFAULT_SCORE_BANDS } from "./dailyForwardScoreBands.mjs";

export function compareForwardScoreBandsAcrossPeriods(rows, {
  verifiedSessions, cutoffDate, embargoSessions = 20,
  minSamplePerPeriod = 20,
} = {}) {
  if (!Array.isArray(rows) || !Array.isArray(verifiedSessions)) throw new TypeError("rows and verifiedSessions must be arrays");
  if (!verifiedSessions.length || verifiedSessions.some((d,i)=>typeof d!=="string" || (i && d<=verifiedSessions[i-1]))) throw new Error("sessions must be sorted unique");
  const cutoff=verifiedSessions.indexOf(cutoffDate);
  if (cutoff<1 || cutoff>=verifiedSessions.length-1) throw new Error("cutoffDate must be an interior verified session");
  if (!Number.isSafeInteger(embargoSessions) || embargoSessions<0 ||
      !Number.isSafeInteger(minSamplePerPeriod) || minSamplePerPeriod<1) throw new Error("invalid thresholds");
  const index=new Map(verifiedSessions.map((d,i)=>[d,i]));
  const horizons=[...new Set(rows.map((r)=>r.horizon))].filter((h)=>Number.isSafeInteger(h)&&h>0).sort((a,b)=>a-b);
  return horizons.flatMap((horizon)=>DEFAULT_SCORE_BANDS.map((band)=>{
    const filtered=rows.filter((r)=>r.horizon===horizon &&
      typeof r.score==="number" && Number.isFinite(r.score) &&
      r.score>=band.min && r.score<=band.max &&
      r.status==="VERIFIED" && typeof r.returnPct==="number" && Number.isFinite(r.returnPct) &&
      index.has(r.date));
    // Train outcomes must have fully matured before cutoff; holdout starts after embargo.
    const train=filtered.filter((r)=>index.get(r.date)+horizon<cutoff);
    const holdout=filtered.filter((r)=>index.get(r.date)>=cutoff+embargoSessions);
    const summarize=(values)=>({
      n:values.length,
      positiveRate:values.length>=minSamplePerPeriod?values.filter((r)=>r.returnPct>0).length/values.length:null,
      averageReturnPct:values.length>=minSamplePerPeriod?Math.round(values.reduce((s,r)=>s+r.returnPct,0)/values.length*100)/100:null,
      distinctCodes:new Set(values.map((r)=>r.code)).size,
      distinctDates:new Set(values.map((r)=>r.date)).size,
    });
    const historical=summarize(train), future=summarize(holdout);
    const comparable=historical.positiveRate!==null&&future.positiveRate!==null;
    return {
      horizon,band:band.label,cutoffDate,embargoSessions,historical,future,
      positiveRateDifference:comparable?future.positiveRate-historical.positiveRate:null,
      status:comparable?"DESCRIPTIVE_HOLDOUT_ONLY":"INSUFFICIENT_PERIOD_COVERAGE",
      warning:"Cutoff must be pre-registered; repeated stocks, regime shifts and selection bias remain possible.",
    };
  }));
}
