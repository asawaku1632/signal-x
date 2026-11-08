import { NECKLINE_FEATURE_AXES } from "./necklineFrozenFeatures.mjs";

/**
 * Research-only breakdowns. Historical replay: absolutely NO rule search,
 * threshold optimization, real-time signal, order, notifications, DB writes.
 *
 * Entry eligibility and features were frozen in the upstream candidate replay.
 * Realized losses belong only to outcome tables, never to a candidate filter.
 */
export const NECKLINE_LOSS_DIAGNOSTICS_VERSION = "NECKLINE_LOSS_DIAGNOSTICS_V1";
export const NECKLINE_REFERENCE_EXCLUSION_CODE = "3996"; // explicitly requested sensitivity study
const SCENARIOS = ["DETECTION", "NEAR", "BREAKOUT"];
const round = x => Math.round(x * 100) / 100;
const valid = x => typeof x === "number" && Number.isFinite(x);

function stats(values) {
  const xs = values.filter(valid).sort((a,b) => a-b);
  if (!xs.length) return { n:0, mean:null, median:null, worst:null, positiveRate:null };
  return {
    n:xs.length, mean:round(xs.reduce((a,b)=>a+b,0)/xs.length),
    median:round(xs.length%2 ? xs[(xs.length-1)/2] : (xs[xs.length/2-1]+xs[xs.length/2])/2),
    worst:round(xs[0]),
    positiveRate:round(xs.filter(x=>x>0).length/xs.length*100),
  };
}

function reportForScenario(rows, scenario) {
  const entered = rows.filter(row => row.scenarios?.[scenario]?.qualified === true);
  const matured = entered.filter(row => row.scenarios[scenario].hold5 !== null);
  const returns = matured.map(row => row.scenarios[scenario].hold5.returnPercent);
  const losses3 = returns.filter(x=>x<=-3).length;
  const losses5 = returns.filter(x=>x<=-5).length;
  return {
    scenario,
    candidates:rows.length, eligible:entered.length, notEntered:rows.length-entered.length,
    matured:matured.length, pending:entered.length-matured.length,
    symbols:new Set(matured.map(row=>row.code)).size,
    returns:stats(returns),
    losses3,losses5,
    losses3Rate:matured.length?round(losses3/matured.length*100):null,
    losses5Rate:matured.length?round(losses5/matured.length*100):null,
  };
}

/**
 * Diagnostic exclusions. These are NOT counterfactual trading strategies:
 * the removed code was identified from prior observed losses.
 */
function exclusionSensitivity(rows) {
  const codes=[...new Set(rows.map(row=>row.code))].sort();
  const full=SCENARIOS.map(id=>reportForScenario(rows,id));
  const withoutReference=SCENARIOS.map(id=>reportForScenario(
    rows.filter(row=>row.code!==NECKLINE_REFERENCE_EXCLUSION_CODE),id,
  ));
  const bySymbol=codes.map(code=>{
    const remaining=rows.filter(row=>row.code!==code);
    const base=reportForScenario(rows,"DETECTION");
    const omitted=reportForScenario(remaining,"DETECTION");
    return {
      code, removedCandidates:rows.length-remaining.length,
      allCandidates:base.candidates, remainingCandidates:omitted.candidates,
      full:base, afterExclusion:omitted,
      differenceMean:base.returns.mean===null||omitted.returns.mean===null
        ? null:round(omitted.returns.mean-base.returns.mean),
      // Size of change, not a ranking of good or bad stocks to trade.
    };
  });
  return {
    referenceCode:NECKLINE_REFERENCE_EXCLUSION_CODE,
    excludedCandidates:rows.filter(row=>row.code===NECKLINE_REFERENCE_EXCLUSION_CODE).length,
    all:full,withoutReference,bySymbol,
  };
}

function paired(rows, first, second) {
  const pairRows=rows.filter(row=>
    row.scenarios?.[first]?.qualified === true
    && row.scenarios[first].hold5 !== null
    && row.scenarios?.[second]?.qualified === true
    && row.scenarios[second].hold5 !== null);
  const a=pairRows.map(row=>row.scenarios[first].hold5.returnPercent);
  const b=pairRows.map(row=>row.scenarios[second].hold5.returnPercent);
  const delta=pairRows.map(row=>round(row.scenarios[second].hold5.returnPercent-row.scenarios[first].hold5.returnPercent));
  return {
    first,second,n:pairRows.length,
    symbols:new Set(pairRows.map(row=>row.code)).size,
    firstStats:stats(a),secondStats:stats(b),difference:stats(delta),
    secondBetterCount:delta.filter(x=>x>0).length,
    sameCount:delta.filter(x=>x===0).length,
    secondWorseCount:delta.filter(x=>x<0).length,
    firstLosses5:a.filter(x=>x<=-5).length,
    secondLosses5:b.filter(x=>x<=-5).length,
    notes:"同一候補でも購入日と5日後の終了日が異なる。③を選べるのは事後的に上抜けした候補だけであり、購入前に③の成立を確約できない。",
  };
}

function predefinedRiskStrata(rows) {
  return NECKLINE_FEATURE_AXES.map(axis=>{
    const groups=[...axis.bins.map(bin=>({id:bin.id,label:bin.label})),{
      id:"UNKNOWN",label:"データ不足",
    }].map(bin=>{
      const subset=rows.filter(row=>(row.frozenFeatures?.buckets?.[axis.id]??"UNKNOWN")===bin.id);
      const summary=reportForScenario(subset,"DETECTION");
      return {
        id:bin.id,label:bin.label,events:subset.length,
        distinctSymbols:new Set(subset.map(row=>row.code)).size,
        matured:summary.matured,pending:summary.pending,
        loss3:summary.losses3,loss5:summary.losses5,
        loss3Rate:summary.losses3Rate,loss5Rate:summary.losses5Rate,
        mean5:summary.returns.mean,worst5:summary.returns.worst,
      };
    });
    const assigned=groups.reduce((n,g)=>n+g.events,0);
    if (assigned!==rows.length) throw new Error("missing candidate in frozen risk groups: "+axis.id);
    return {id:axis.id,title:axis.title,groups:groups.filter(g=>g.events>0||g.id!=="UNKNOWN")};
  });
}

export function diagnoseNecklineLossRisk(rows) {
  if(!Array.isArray(rows))throw new Error("invalid risk diagnostic records");
  for (const row of rows) {
    if(typeof row.code!=="string"||!/^[0-9]{4}$/.test(row.code)
      ||!row.scenarios||!SCENARIOS.every(id=>row.scenarios[id]
      &&typeof row.scenarios[id].qualified==="boolean"
      &&(row.scenarios[id].hold5===null
      ||valid(row.scenarios[id].hold5?.returnPercent)))) {
      throw new Error("invalid research row");
    }
  }
  return {
    version:NECKLINE_LOSS_DIAGNOSTICS_VERSION,
    exploratoryOnly:true,
    selectedAfterObservingResults:true,
    selectionValidated:false,
    candidateCount:rows.length,
    exclusion:exclusionSensitivity(rows),
    matched:[
      paired(rows,"DETECTION","BREAKOUT"),
      paired(rows,"NEAR","BREAKOUT"),
    ],
    detectionNearSameTrade:true,
    riskStrata:predefinedRiskStrata(rows),
  };
}
