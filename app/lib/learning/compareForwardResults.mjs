// Research-only comparison. Never used by live scoring or notifications.
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function compareForwardResults(captures, outcomes) {
  const accepted = [];
  const rejected = [];
  const indexed = new Map();
  for (const outcome of outcomes) {
    const key = `${outcome?.scan_run_id}|${outcome?.code}`;
    indexed.set(key, [...(indexed.get(key) ?? []), outcome]);
  }
  const captureCounts = new Map();
  for (const capture of captures) {
    const key = JSON.stringify([capture?.scan_run_id, capture?.code]);
    captureCounts.set(key, (captureCounts.get(key) ?? 0) + 1);
  }
  for (const capture of captures) {
    const reject = reason => rejected.push({ scan_run_id: capture?.scan_run_id ?? null, code: capture?.code ?? null, reason });
    if ((captureCounts.get(JSON.stringify([capture?.scan_run_id, capture?.code])) ?? 0) > 1) { reject('DUPLICATE_CAPTURE'); continue; }
    if (!capture || capture.capture_status !== 'ASOF_VERIFIED' || capture.provenance_verified !== true) { reject('UNVERIFIED_CAPTURE'); continue; }
    if (!validTime(capture.scan_received_at) || !validTime(capture.source_bar_at) || !validTime(capture.features_computed_at) || Date.parse(capture.source_bar_at) > Date.parse(capture.scan_received_at) || Date.parse(capture.features_computed_at) > Date.parse(capture.scan_received_at)) { reject('INVALID_ASOF_TIMING'); continue; }
    if (typeof capture.ai_power !== 'number' || !Number.isFinite(capture.ai_power) || capture.ai_power < 0 || capture.ai_power > 100) { reject('INVALID_AI_POWER'); continue; }
    const matches = indexed.get(`${capture.scan_run_id}|${capture.code}`) ?? [];
    if (matches.length !== 1) { reject('MISSING_OR_AMBIGUOUS_OUTCOME'); continue; }
    const outcome = matches[0];
    if (outcome.independent_source_verified !== true || !validTime(outcome.observed_at) || Date.parse(outcome.observed_at) <= Date.parse(capture.scan_received_at) || !Number.isFinite(outcome.return_pct)) { reject('UNVERIFIED_FUTURE_OUTCOME'); continue; }
    if (outcome.horizon_days !== 5 || outcome.outcome_version !== 'forward-v1' || outcome.horizon_verified !== true) { reject('MISMATCHED_HORIZON'); continue; }
    // Five *market sessions*, not five calendar days. The list must come from
    // an independently verified exchange calendar; it is not generated here.
    const sessions = outcome.verified_session_dates;
    const dateRe = /^\\d{4}-\\d{2}-\\d{2}$/;
    const validDay = day => typeof day === 'string' && dateRe.test(day)
      && !Number.isNaN(Date.parse(day+'T00:00:00Z'))
      && new Date(day+'T00:00:00Z').toISOString().slice(0,10) === day;
    const sessionDatesValid = Array.isArray(sessions) && sessions.length === 5
      && sessions.every(validDay)
      && sessions.every((day,i)=>i===0 || sessions[i-1] < day)
      && (() => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
        }).formatToParts(new Date(outcome.observed_at));
        const date = Object.fromEntries(parts.map(part=>[part.type,part.value]));
        return sessions[4] === `${date.year}-${date.month}-${date.day}`;
      })();
    if (!sessionDatesValid) { reject('MISSING_VERIFIED_TRADING_SESSIONS'); continue; }
    accepted.push({ scan_run_id: capture.scan_run_id, code: capture.code, ai_power: capture.ai_power, return_pct: outcome.return_pct, horizon_days: 5 });
  }
  return { accepted, rejected };
}
