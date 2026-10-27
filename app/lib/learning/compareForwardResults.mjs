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
  for (const capture of captures) {
    const reject = reason => rejected.push({ scan_run_id: capture?.scan_run_id ?? null, code: capture?.code ?? null, reason });
    if (!capture || capture.capture_status !== 'ASOF_VERIFIED' || capture.provenance_verified !== true) { reject('UNVERIFIED_CAPTURE'); continue; }
    if (!validTime(capture.scan_received_at) || !validTime(capture.source_bar_at) || !validTime(capture.features_computed_at) || Date.parse(capture.source_bar_at) > Date.parse(capture.scan_received_at) || Date.parse(capture.features_computed_at) > Date.parse(capture.scan_received_at)) { reject('INVALID_ASOF_TIMING'); continue; }
    const matches = indexed.get(`${capture.scan_run_id}|${capture.code}`) ?? [];
    if (matches.length !== 1) { reject('MISSING_OR_AMBIGUOUS_OUTCOME'); continue; }
    const outcome = matches[0];
    if (outcome.independent_source_verified !== true || !validTime(outcome.observed_at) || Date.parse(outcome.observed_at) <= Date.parse(capture.scan_received_at) || !Number.isFinite(outcome.return_pct)) { reject('UNVERIFIED_FUTURE_OUTCOME'); continue; }
    if (outcome.horizon_days !== 5 || outcome.outcome_version !== 'forward-v1' || outcome.horizon_verified !== true) { reject('MISMATCHED_HORIZON'); continue; }
    accepted.push({ scan_run_id: capture.scan_run_id, code: capture.code, ai_power: capture.ai_power, return_pct: outcome.return_pct, horizon_days: 5 });
  }
  return { accepted, rejected };
}
