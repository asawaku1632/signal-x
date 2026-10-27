/**
 * Conservative descriptive stability check, offline only.
 * Groups verified forward returns by horizon and score band, then by code.
 * No p-values or "significance" claims from overlapping observations.
 */
import { DEFAULT_SCORE_BANDS } from "./dailyForwardScoreBands.mjs";

export function checkForwardScoreBandStability(rows, { minDistinctCodes = 10, minDistinctDates = 10 } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  if (![minDistinctCodes,minDistinctDates].every((n)=>Number.isSafeInteger(n)&&n>0)) {
    throw new Error("minimums must be positive integers");
  }
  const horizons=[...new Set(rows.map((r)=>r.horizon))].filter((h)=>Number.isSafeInteger(h)&&h>0).sort((a,b)=>a-b);
  return horizons.flatMap((horizon)=>DEFAULT_SCORE_BANDS.map((band)=>{
    const candidates=rows.filter((r)=>r.horizon===horizon && typeof r.score==="number" &&
      Number.isFinite(r.score) && r.score>=band.min && r.score<=band.max);
    const verified=candidates.filter((r)=>r.status==="VERIFIED" &&
      typeof r.returnPct==="number" && Number.isFinite(r.returnPct) &&
      typeof r.code==="string" && typeof r.date==="string");
    const codes=new Set(verified.map((r)=>r.code));
    const dates=new Set(verified.map((r)=>r.date));
    const perCode=new Map();
    for(const r of verified){
      const values=perCode.get(r.code)??[];
      values.push(r.returnPct);
      perCode.set(r.code,values);
    }
    const codeMeans=[...perCode.values()].map((values)=>values.reduce((a,b)=>a+b,0)/values.length);
    const positiveCodeShare=codeMeans.length ? codeMeans.filter((v)=>v>0).length/codeMeans.length : null;
    const largestCodeShare=verified.length ? Math.max(...[...perCode.values()].map((v)=>v.length))/verified.length : null;
    const sufficient=codes.size>=minDistinctCodes && dates.size>=minDistinctDates;
    return {
      horizon, band:band.label, verifiedRows:verified.length,
      distinctCodes:codes.size, distinctSignalDates:dates.size,
      largestCodeShare, positiveCodeShare:sufficient?positiveCodeShare:null,
      status:sufficient?"DESCRIPTIVE_STABILITY_ONLY":"INSUFFICIENT_INDEPENDENT_COVERAGE",
      note:"Repeated codes and overlapping holding periods may be dependent; no statistical significance or causal edge is claimed.",
    };
  }));
}
