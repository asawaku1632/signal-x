/** Research-only adapter. Never infer market regime from future returns. */
import { summarizeMa75Robustness } from './ma75ReturnRobustness.mjs';

const dateFromSignal = seconds => {
  if (!Number.isSafeInteger(seconds)) throw new TypeError('Invalid signal timestamp');
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid signal timestamp');
  return date.toISOString().slice(0, 10);
};

/**
 * The regime lookup must be built from information known by each signal close.
 * Unknown regimes remain UNKNOWN, not silently removed.
 */
export function auditMa75StudyRobustness(study, {
  kind = 'BREAKOUT',
  regimeByDate = {},
  requireAsOfRegimeEvidence = true,
} = {}) {
  if (!Array.isArray(study?.observations) || !['BREAKOUT','RETEST'].includes(kind) ||
      !regimeByDate || typeof regimeByDate !== 'object' || Array.isArray(regimeByDate))
    throw new TypeError('Invalid study or regime lookup');
  const pending = { pending: 0, quarantined: 0, invalid: 0 };
  const rows = [];
  for (const row of study.observations) {
    if (row?.kind !== kind) continue;
    if (row.outcome5Status === 'PENDING') { pending.pending++; continue; }
    if (String(row.outcome5Status).startsWith('QUARANTINED')) {
      pending.quarantined++; continue;
    }
    if (row.outcome5Status !== 'COMPLETED' ||
        !Number.isFinite(row.return5Percent)) { pending.invalid++; continue; }
    const date = dateFromSignal(row.signalTime);
    const evidence = regimeByDate[date];
    let regime = 'UNKNOWN';
    if (evidence !== undefined) {
      if (typeof evidence === 'object' && evidence !== null &&
          ['UP','DOWN'].includes(evidence.regime) &&
          Number.isSafeInteger(evidence.availableAt) &&
          evidence.availableAt <= row.signalTime) regime = evidence.regime;
      else if (!requireAsOfRegimeEvidence && ['UP','DOWN'].includes(evidence))
        regime = evidence;
    }
    rows.push({ code: String(row.code), date,
      return5Percent: row.return5Percent, regime });
  }
  return { ...summarizeMa75Robustness(rows), kind, excluded: pending,
    regimeProvenanceExternallyVerified: false,
    warnings: [
      'Regime labels must be certified as available at signal time.',
      'Completed observations only; excluded rows are never treated as losses.',
      'Exploratory selected and overlapping events cannot establish a trading edge.',
    ] };
}
