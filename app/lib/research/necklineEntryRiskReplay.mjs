import { auditNecklineQuality, NECKLINE_ROUND_TRIP_COST_PERCENT } from "./necklineQualityAudit.mjs";
import { completedDailyBars } from "./observedNecklineOverlay.mjs";

export const NECKLINE_ENTRY_RISK_VERSION = "NECKLINE_ENTRY_RISK_REPLAY_V1";
export const NECKLINE_CHRONOLOGICAL_SPLIT = "2026-08-01";
export const NECKLINE_EXTENDED_MAX_SYMBOLS = 15;
const round = x => Math.round(x * 100) / 100;

export const NECKLINE_ENTRY_SCENARIOS = [
  { id: "DETECTION", title: "① 底②の確定を確認した翌営業日", description: "すべての候補で、初検出の翌営業日始値を仮の購入価格とする" },
  { id: "NEAR", title: "② ネックラインまで5%以内なら翌営業日", description: "初検出日の終値がネックラインまで5%以内だった候補だけを対象とする" },
  { id: "BREAKOUT", title: "③ 終値上抜けを確認した翌営業日", description: "終値でネックラインを上抜けた翌営業日始値で初めて仮の購入を行う。上抜けなかった候補は未購入" },
];

const valid = x => typeof x === "number" && Number.isFinite(x);
function metric(values) {
  const arr = values.filter(valid).sort((a,b) => a-b);
  if (!arr.length) return { completed:0, meanPercent:null, medianPercent:null, positivePercent:null, worstPercent:null };
  return {
    completed:arr.length,
    meanPercent:round(arr.reduce((a,b)=>a+b,0)/arr.length),
    medianPercent:round(arr.length%2 ? arr[(arr.length-1)/2] : (arr[arr.length/2-1]+arr[arr.length/2])/2),
    positivePercent:round(arr.filter(x=>x>0).length*100/arr.length),
    worstPercent:round(arr[0]),
  };
}

// A decision is made after close of bar "at". Entry cannot occur until next
// completed session OPEN. No fill can be inferred from intraday high/low.
function simulatedTrade(bars, at, holdingSessions) {
  if (!Number.isInteger(at) || at < 0 || at + holdingSessions >= bars.length) return null;
  const entry = bars[at+1]?.open, exit=bars[at+holdingSessions]?.close;
  const lows=bars.slice(at+1,at+holdingSessions+1).map(b=>b.low);
  if (!(entry>0 && exit>0) || lows.length !== holdingSessions || lows.some(x=>!(x>0))) return null;
  return {
    returnPercent:round((exit/entry-1)*100-NECKLINE_ROUND_TRIP_COST_PERCENT),
    maxAdversePercent:round((Math.min(...lows)/entry-1)*100),
  };
}

function summarizeScenario(rows, id) {
  const candidates=rows.length;
  const qualified=rows.filter(row=>row.scenarios[id].qualified);
  const mature3=qualified.map(row=>row.scenarios[id].hold3).filter(x=>x!==null);
  const mature5=qualified.map(row=>row.scenarios[id].hold5).filter(x=>x!==null);
  return {
    id, candidates, qualified:qualified.length, noEntry:candidates-qualified.length,
    pending3:qualified.length-mature3.length,
    pending5:qualified.length-mature5.length,
    day3:metric(mature3.map(x=>x.returnPercent)),
    day5:metric(mature5.map(x=>x.returnPercent)),
    drawdown5:metric(mature5.map(x=>x.maxAdversePercent)),
    loss3Percent: mature5.length ? round(mature5.filter(x=>x.returnPercent<=-3).length/mature5.length*100) : null,
    loss5Percent: mature5.length ? round(mature5.filter(x=>x.returnPercent<=-5).length/mature5.length*100) : null,
    severe3: mature5.filter(x=>x.returnPercent<=-3).length,
    severe5: mature5.filter(x=>x.returnPercent<=-5).length,
  };
}

/**
 * A bounded manual historical replay, *not* independent prospective evidence.
 * 15 symbols max. Both May-Jul and Aug-Nov history were already observable
 * when these preset rules were written. The split is descriptive, not OOS.
 */
export function replayNecklineEntryRisk(stocks, now = new Date()) {
  const audit = auditNecklineQuality(stocks, now, {maxSymbols:NECKLINE_EXTENDED_MAX_SYMBOLS});
  const barsByCode = new Map(stocks.map(stock=>[stock.code,completedDailyBars(stock.candles,now)]));
  const records=audit.events.map(event=>{
    const bars=barsByCode.get(event.code) ?? [];
    const closeToNeckline=event.frozenFeatures?.buckets.necklineDistancePercent === "CLOSE";
    const hasBreakout=event.status === "BREAKOUT" && Number.isInteger(event.breakoutIndex);
    const createScenario=(qualified,index)=>({
      qualified,
      hold3:qualified ? simulatedTrade(bars,index,3) : null,
      hold5:qualified ? simulatedTrade(bars,index,5) : null,
    });
    return {
      code:event.code, firstSeenDate:event.firstSeenDate,
      status:event.status, neckline:event.neckline,
      firstSeenIndex:event.firstSeenIndex, breakoutIndex:event.breakoutIndex,
      frozenFeatures:event.frozenFeatures,
      scenarios:{
        DETECTION:createScenario(true,event.firstSeenIndex),
        NEAR:createScenario(closeToNeckline,event.firstSeenIndex),
        BREAKOUT:createScenario(hasBreakout,event.breakoutIndex),
      },
    };
  });
  const chronological=[
    { id:"EARLIER",title:"前半：2026年7月31日まで", records:records.filter(e=>e.firstSeenDate<NECKLINE_CHRONOLOGICAL_SPLIT) },
    { id:"LATER",title:"後半：2026年8月1日以降", records:records.filter(e=>e.firstSeenDate>=NECKLINE_CHRONOLOGICAL_SPLIT) },
  ];
  const worstCases=records.filter(row=>row.scenarios.DETECTION.hold5!==null)
    .sort((a,b)=>a.scenarios.DETECTION.hold5.returnPercent-b.scenarios.DETECTION.hold5.returnPercent)
    .slice(0,8)
    .map(row=>({
      code:row.code, firstSeenDate:row.firstSeenDate, status:row.status,
      early5:row.scenarios.DETECTION.hold5.returnPercent,
      worstAdverse:row.scenarios.DETECTION.hold5.maxAdversePercent,
      distancePercent:row.frozenFeatures?.measurements.necklineDistancePercent ?? null,
      volumeRatio:row.frozenFeatures?.measurements.volumeRatio ?? null,
    }));
  return {
    version:NECKLINE_ENTRY_RISK_VERSION,
    source:audit.source,
    replayOnly:true,
    prospective:false,
    independentOutOfSample:false,
    chronologicalSplit:NECKLINE_CHRONOLOGICAL_SPLIT,
    sample:{requestedSymbols:audit.requestedSymbols,usableSymbols:audit.usableSymbols,
      excludedSymbols:audit.excludedSymbols,candidates:records.length,details:audit.details,
      earliestDate:audit.earliestDate,latestDate:audit.latestDate,completedDailyBars:audit.completedDailyBars},
    status:audit.byStatus,
    scenarios:NECKLINE_ENTRY_SCENARIOS.map(config=>({...config,...summarizeScenario(records,config.id)})),
    periods:chronological.map(({id,title,records:subset})=>({
      id,title,candidates:subset.length,
      symbols:new Set(subset.map(e=>e.code)).size,
      scenarios:NECKLINE_ENTRY_SCENARIOS.map(config=>({...config,...summarizeScenario(subset,config.id)})),
    })),
    worstCases,
    records, // used in static tests and only within owner-only responses
  };
}
