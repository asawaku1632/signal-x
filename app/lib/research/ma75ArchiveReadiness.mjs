/**
 * SHADOW ONLY: audit frozen study population against already-saved chart histories.
 * No provider fetch, database access, notifications or production-facing signal.
 * Historic chart completeness does not authenticate capture times or usage rights.
 */
export const MA75_ARCHIVE_READINESS_VERSION = 'ma75_archive_readiness_v2';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const integer = v => Number.isSafeInteger(v) && v >= 946684800 && v < 4102444800;
const isoMs = v => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN;
const avg = xs => xs.reduce((a,b) => a+b,0)/xs.length;
const round = v => Number(v.toFixed(5));
const codePattern = /^[0-9]{3}[0-9A-Z]$/;
const validDay = d=>typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const barDay = b=>new Date(b.time*1000).toISOString().slice(0,10);
const validBar = b => b && integer(b.time) &&
  [b.open,b.high,b.low,b.close,b.volume].every(finite) &&
  b.open>0 && b.low>0 && b.high>0 && b.close>0 && b.volume>=0 &&
  b.low<=Math.min(b.open,b.close) && b.high>=Math.max(b.open,b.close);

/** Every frozen code stays in the denominator, even when no chart is saved. */
export function auditMa75ArchiveReadiness(freeze, snapshots, {auditCutoff,referenceTradeDate}={}) {
  if (!freeze || freeze.schemaVersion!=='ma75-forward-universe-candidate-freeze-v1' ||
    !Array.isArray(freeze.codes) || !freeze.codes.length ||
    freeze.populationSize!==freeze.codes.length ||
    freeze.codes.some((c,i) => typeof c!=='string'||!codePattern.test(c)||
      (i>0 && c<=freeze.codes[i-1])) ||
    !Array.isArray(snapshots)) {
    throw new TypeError('Require a valid sorted frozen population and snapshot list');
  }
  const frozenAt = isoMs(freeze.frozenAt);
  const cutoff = auditCutoff===undefined ? Infinity : isoMs(auditCutoff);
  if(referenceTradeDate!==undefined&&!validDay(referenceTradeDate))
    throw new TypeError('Reference trading date must be an explicit real ISO day');
  if (!Number.isFinite(frozenAt) || Number.isNaN(cutoff) || cutoff<frozenAt)
    throw new TypeError('Invalid archive audit time window');
  const allowed=new Set(freeze.codes), indexes=new Map(), outOfCohort=[];
  for (const s of snapshots) {
    const code=s?.code;
    if (!allowed.has(code)) {
      outOfCohort.push(String(code??'?'));
      continue;
    }
    indexes.set(code,[...(indexes.get(code)??[]),s]);
  }
  const results=[];
  for (const code of freeze.codes) {
    const group=indexes.get(code)??[];
    let status='NO_SAVED_DAILY_CHART';
    let detail=null;
    if (group.length>1) status='QUARANTINED_DUPLICATE_SNAPSHOT';
    else if (group.length===1) {
      const snapshot=group[0], bars=snapshot.candles;
      const saved=isoMs(snapshot.updatedAt);
      if (snapshot.timeframe!=='1D' || typeof snapshot.provider!=='string' ||
          snapshot.provider.trim().length<3 || !Number.isFinite(saved) || saved>cutoff ||
          saved>frozenAt || saved<frozenAt-365*86400000 || !Array.isArray(bars)) {
        status='QUARANTINED_SNAPSHOT_PROVENANCE';
      } else if (bars.length<76) {
        status='INSUFFICIENT_75DAY_WARMUP';
      } else if (!bars.every(validBar) || bars.some((bar,i) => i>0 &&
          (bar.time<=bars[i-1].time ||
          new Date(bar.time*1000).toISOString().slice(0,10)===
          new Date(bars[i-1].time*1000).toISOString().slice(0,10))) ||
          bars.at(-1).time*1000>saved) {
        status='QUARANTINED_BAR_OR_TIME';
      } else if (bars.some((bar,i) => i>0 && Math.abs(bar.close/bars[i-1].close-1)>0.45)) {
        status='QUARANTINED_SPLIT_REVIEW';
      } else {
        const n=bars.length-1;
        const lastBarDate=barDay(bars[n]);
        status=referenceTradeDate===undefined||lastBarDate===referenceTradeDate?
          'HISTORICAL_ONLY_UNVERIFIED':
          lastBarDate<referenceTradeDate?'HISTORICAL_ONLY_STALE_REFERENCE':
          'QUARANTINED_BAR_AFTER_REFERENCE';
        const ma75=avg(bars.slice(n-74,n+1).map(b=>b.close));
        const priorMa75=avg(bars.slice(n-75,n).map(b=>b.close));
        const volumes=bars.slice(n-20,n).map(b=>b.volume);
        const volRatio=volumes.every(v=>v>0) && bars[n].volume>0
          ? bars[n].volume/avg(volumes) : null;
        detail={provider:snapshot.provider,updatedAt:snapshot.updatedAt,
          firstBarTime:bars[0].time,lastBarTime:bars.at(-1).time,
          lastBarDate,referenceTradeDate:referenceTradeDate??null,
          barCount:bars.length,ma75:round(ma75),ma75Rising:ma75>priorMa75,
          prior20VolumeRatio:volRatio===null?null:round(volRatio),
          eligibleForForwardSignal:false,
          eligibleForReferenceSignal:false};
      }
    }
    results.push({code,status,detail});
  }
  const counts=Object.fromEntries([...new Set(results.map(r=>r.status))].sort()
    .map(status=>[status,results.filter(r=>r.status===status).length]));
  const referenceDayMatches=counts.HISTORICAL_ONLY_UNVERIFIED??0;
  const stale=counts.HISTORICAL_ONLY_STALE_REFERENCE??0;
  const historical=referenceDayMatches+stale;
  return {version:MA75_ARCHIVE_READINESS_VERSION,
    universeSize:freeze.codes.length,chartSnapshots:snapshots.length,
    outOfFrozenCohort:outOfCohort,counts,
    usableHistoricalOnly:historical,
    missingOrBlocked:freeze.codes.length-historical,
    historicalCoveragePercent:round(100*historical/freeze.codes.length),
    referenceTradeDate:referenceTradeDate??null,
    lastBarOnReferenceDate:referenceTradeDate===undefined?null:referenceDayMatches,
    staleHistoricalCharts:referenceTradeDate===undefined?null:stale,
    referenceDateBarCoveragePercent:referenceTradeDate===undefined?null:
      round(100*referenceDayMatches/freeze.codes.length),
    rows:results,
    barDataUsageRightsVerified:false,independentlyProvenCaptures:false,
    prospectiveWholeUniverseReady:false,eligibleForProduction:false,
    eligibleForNotifications:false,validatedForwardWinRate:null,
    warnings:[
      'Historical Yahoo chart snapshots are not independently verified licensed data.',
      'Saved chart views are a selectively observed subset, not all frozen symbols.',
      'A chart with 76+ older bars does not establish an up-to-date SMA75 as of the specified reference date. Only exact last-bar-date matches count toward reference coverage.',
      'No fresh forward bar source, guaranteed as-of capture, official trading calendar or corporate-action registry is provided.',
    ]};
}
