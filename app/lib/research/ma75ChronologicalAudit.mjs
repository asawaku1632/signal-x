/** Read-only, pure in-memory shadow statistics. Never a live ranking or trading signal. */
export const MA75_CHRONO_VERSION = 'ma75_chronological_audit_v1';
const finite = n => typeof n === 'number' && Number.isFinite(n);
const mean = values => values.reduce((a,b)=>a+b,0)/values.length;
const round = n => Number(n.toFixed(3));
const RULES = [
  ['ALL', r => true],
  ['SMA75_RISING',r=>r.ma75Rising===true],
  ['VOLUME_1_5',r=>finite(r.volumeRatio)&&r.volumeRatio>=1.5],
  ['BOTH',r=>r.ma75Rising===true&&finite(r.volumeRatio)&&r.volumeRatio>=1.5],
];
const tradingDate = unixSeconds => new Date(unixSeconds*1000).toISOString().slice(0,10);
/**
 * Strict 15:15 JST, same-day, auditable score that already existed by the 15:30 JST close.
 * Fail closed on duplicates, invalid times, missing raw timestamps, missing score and other slots.
 * Such score evidence is still NOT provider-verified or forward-validated.
 */
export function validatedAiAtClose(observation, evidence) {
  if (!Number.isSafeInteger(observation.signalTime) || !Number.isSafeInteger(observation.signalIndex))
    return {status:'INVALID_SIGNAL',aiPower:null};
  const day=tradingDate(observation.signalTime);
  const candidates=evidence.filter(e=>e?.code===observation.code&&e.tradeDate===day&&e.timeSlot==='15:15');
  if (!candidates.length) return {status:'NOT_OBSERVED',aiPower:null};
  if (candidates.length!==1) return {status:'DUPLICATE',aiPower:null};
  const e=candidates[0];
  const closeMs=Date.parse(`${day}T06:30:00.000Z`);
  const quote=Date.parse(e.quoteTimestamp),snapshot=Date.parse(e.snapshotSavedAt),created=Date.parse(e.createdAt);
  if (![quote,snapshot,created].every(Number.isFinite) || quote>snapshot || snapshot>created ||
      created>closeMs || quote<Date.parse(`${day}T00:00:00.000Z`))
    return {status:'INVALID_ASOF',aiPower:null};
  if (!finite(e.aiPower)||e.aiPower<0||e.aiPower>100)
    return {status:'INVALID_SCORE',aiPower:null};
  return {status:'OBSERVED_ASOF',aiPower:e.aiPower};
}
function stats(entries) {
  const done=entries.filter(x=>finite(x.return5Percent));
  const returns=done.map(x=>x.return5Percent);
  return {
    candidates:entries.length,completed:done.length,
    pending:entries.filter(x=>x.outcome5Status==='PENDING').length,
    quarantined:entries.filter(x=>x.outcome5Status==='QUARANTINED_GAP').length,
    codes:new Set(done.map(x=>x.code)).size,
    average5Percent:returns.length?round(mean(returns)):null,
    positive5Percent:returns.length?round(returns.filter(x=>x>0).length/returns.length*100):null,
    adequateForDescriptiveComparison:returns.length>=30&&new Set(done.map(x=>x.code)).size>=20,
    budgetCompleted:done.filter(x=>x.budgetEligible).length,
  };
}
export function auditMa75Chronology(study, {splitDate, aiEvidence=[]}={}) {
  if (!/^20\d\d-\d\d-\d\d$/.test(splitDate??'') ||
      !Number.isFinite(Date.parse(`${splitDate}T00:00:00Z`)))
    throw new TypeError('Provide YYYY-MM-DD splitDate');
  if (!Array.isArray(study?.observations)||!Array.isArray(aiEvidence))
    throw new TypeError('Invalid study or evidence');
  const fields=['BREAKOUT','RETEST'];
  const groups=[];
  for (const period of ['EARLY','LATE']) {
    for (const kind of fields) {
      const relevant=study.observations.filter(r=>r.kind===kind &&
        (period==='EARLY'?tradingDate(r.signalTime)<splitDate:tradingDate(r.signalTime)>=splitDate));
      for (const [variant,predicate] of RULES) {
        groups.push({period,kind,variant,...stats(relevant.filter(predicate))});
      }
    }
  }
  const aiRows=study.observations.map(r=>({...r,ai:validatedAiAtClose(r,aiEvidence)}));
  const completeAi=aiRows.filter(r=>r.ai.status==='OBSERVED_ASOF' && finite(r.return5Percent));
  return {
    version:MA75_CHRONO_VERSION,splitDate,groups,
    aiCoverage:{
      signalObservations:aiRows.length,
      observedAsOf:aiRows.filter(r=>r.ai.status==='OBSERVED_ASOF').length,
      observedComplete:completeAi.length,
      scored90Complete:completeAi.filter(r=>r.ai.aiPower>=90).length,
      rejected:aiRows.filter(r=>!['OBSERVED_ASOF','NOT_OBSERVED'].includes(r.ai.status)).length,
      ai90FiveDayAverage:completeAi.filter(r=>r.ai.aiPower>=90).length?
        round(mean(completeAi.filter(r=>r.ai.aiPower>=90).map(r=>r.return5Percent))):null,
    },
    eligibleForProduction:false,
    warnings:[
      'Post-hoc early/late split is NOT a pre-registered independent holdout.',
      'Saved chart views are a selected, overlapping and potentially survivorship-biased cohort.',
      'AI POWER as-of snapshots must never be reconstructed from later saved scores.',
      'No live activation until a separate prospective, source-verified, risk-aware evaluation.',
    ],
  };
}
