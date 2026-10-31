/**
 * SHADOW / OFFLINE ONLY: a reproducible freeze and chronological evidence audit.
 * This module never downloads data, stores observations or sends trading signals.
 * A plan without source/licence certification stays BLOCKED, not 'validated'.
 */
import { createHash } from 'node:crypto';

export const MA75_FORWARD_PROTOCOL_VERSION = 'ma75_forward_protocol_v1';
export const MA75_PREDECLARED_VARIANTS = Object.freeze([
  'BREAKOUT_ALL',
  'BREAKOUT_SMA75_RISING',
  'BREAKOUT_VOLUME_1_5',
  'BREAKOUT_BOTH',
  'WAIT_FOR_RETEST_OR_CASH',
]);
const CODE_RE = /^[0-9]{3}[0-9A-Z]$/;
const DAY_RE = /^20\d\d-(0[1-9]|1[012])-([012]\d|3[01])$/;
const isDay = value => typeof value === 'string' && DAY_RE.test(value) &&
  !Number.isNaN(Date.parse((value+'T00:00:00Z'))) &&
  new Date((value+'T00:00:00Z')).toISOString().slice(0, 10) === value;
const ms = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
  ? Date.parse(value) : NaN;
const isTimestamp = value => Number.isFinite(ms(value));
const jstDay = value => new Date(ms(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const sha = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');

/**
 * The population is explicit and sorted so subsequent losers cannot be silently dropped.
 * No historical chosen-chart sample is silently used to define the population.
 */
export function createMa75ForwardManifest({
  frozenAt, firstSignalDate, cohortCodes, selectionPolicy, source,
}) {
  if (!isTimestamp(frozenAt) || !isDay(firstSignalDate) ||
      firstSignalDate <= jstDay(frozenAt)) {
    throw new TypeError('Freeze timestamp must predate first eligible JST signal date');
  }
  if (!Array.isArray(cohortCodes) || !cohortCodes.length ||
      cohortCodes.some(c => typeof c !== 'string' || !CODE_RE.test(c)) ||
      new Set(cohortCodes).size !== cohortCodes.length) {
    throw new TypeError('Must freeze explicit unique listed-style securities before results');
  }
  if (typeof selectionPolicy !== 'string' || selectionPolicy.trim().length < 12) {
    throw new TypeError('Provide a reproducible predeclared selection policy');
  }
  if (!source || typeof source.provider !== 'string' || !source.provider.trim() ||
      !['VERIFIED', 'UNVERIFIED'].includes(source.usageRights) ||
      !['VERIFIED', 'UNVERIFIED'].includes(source.corporateActions) ||
      !['VERIFIED', 'UNVERIFIED'].includes(source.timestampProvenance)) {
    throw new TypeError('Explicit source and verified/unverified evidence required');
  }
  const frozen = {
    protocol: MA75_FORWARD_PROTOCOL_VERSION,
    createdAt: new Date(ms(frozenAt)).toISOString(), firstSignalDate,
    codes: [...cohortCodes].sort(), selectionPolicy: selectionPolicy.trim(),
    source: {provider: source.provider.trim(), usageRights: source.usageRights,
      corporateActions: source.corporateActions, timestampProvenance: source.timestampProvenance},
    signal: {
      rule: 'completed close above SMA75 after preceding close at/below SMA75',
      retestSessions: 10, retestTouchBuffer: 0.01, nextOpenExecution: true,
      roundTripFrictionEachSide: 0.001, exitAtSignalPlusTradingSessions: 5,
      cashIfNoRetest: true,
      variants: [...MA75_PREDECLARED_VARIANTS],
    },
  };
  const blockers = Object.entries(frozen.source)
    .filter(([key, value]) => key !== 'provider' && value !== 'VERIFIED')
    .map(([key]) => 'UNVERIFIED_'+key.toUpperCase());
  return {
    ...frozen, manifestSha256: sha(frozen),
    sourceStatus: blockers.length ? 'BLOCKED' : 'SOURCE_EVIDENCE_RECORDED',
    blockers,
    eligibleForProduction: false,
  };
}
export function verifyMa75ForwardManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  const {manifestSha256, sourceStatus, blockers, eligibleForProduction, ...frozen} = manifest;
  return manifest.protocol === MA75_FORWARD_PROTOCOL_VERSION &&
    typeof manifestSha256 === 'string' && sha(frozen) === manifestSha256;
}

/**
 * Validate signal-time trace without outcomes. Data availability is compared
 * with *next open*, preventing a 12-day-delayed quote from being called an
 * actionable next-open prediction. Both capture and decision must be after
 * the completed daily bar, and before the claimed scheduled entry. The
 * claimed entry time still needs independent exchange-calendar verification.
 */
export function auditMa75ForwardEvidence(manifest, evidence = []) {
  if (!verifyMa75ForwardManifest(manifest) || !Array.isArray(evidence)) {
    throw new TypeError('Invalid immutable manifest or evidence list');
  }
  const codeSet = new Set(manifest.codes);
  const seen = new Set();
  const accepted = [], excluded = [];
  for (const item of evidence) {
    const id = String(item?.code ?? '?')+':'+String(item?.tradeDate ?? '?');
    let reason = null;
    if (!codeSet.has(item?.code)) reason = 'NOT_FROZEN_COHORT';
    else if (!isDay(item?.tradeDate) || item.tradeDate < manifest.firstSignalDate)
      reason = 'BEFORE_FROZEN_START';
    else if (seen.has(id)) reason = 'DUPLICATE_CODE_DAY';
    else {
      seen.add(id);
      const expectedClose = Date.parse((item.tradeDate+'T06:30:00Z'));
      const values = [item.barClosedAt, item.barCapturedAt, item.featuresCapturedAt,
        item.signalRecordedAt, item.nextOpenAt].map(ms);
      if (values.some(v => !Number.isFinite(v)) ||
          values[0] !== expectedClose || values[4] <= expectedClose)
        reason = 'MISSING_OR_INVALID_TIMESTAMP';
      else if (values[1] < values[0] || values[2] < values[0] ||
          values[3] < Math.max(values[1], values[2]) || values[3] >= values[4])
        reason = 'LOOKAHEAD_OR_LATE_CAPTURE';
      else if (item.sourceProvider !== manifest.source.provider)
        reason = 'SOURCE_MISMATCH';
      else if (![item.signalClose, item.priorClose, item.sma75, item.priorSma75]
          .every(v => typeof v === 'number' && Number.isFinite(v) && v > 0))
        reason = 'INVALID_PRICE_FACTORS';
      else if (!(item.signalClose > item.sma75 && item.priorClose <= item.priorSma75))
        reason = 'NOT_SMA75_BREAKOUT';
    }
    if (reason) excluded.push({id, reason});
    else accepted.push({code:item.code,tradeDate:item.tradeDate,
      decisionTimestamp:item.signalRecordedAt, sourceProvider:item.sourceProvider});
  }
  return {
    protocol: MA75_FORWARD_PROTOCOL_VERSION,
    manifestSha256: manifest.manifestSha256,
    checked: evidence.length, accepted: accepted.length, rejected: excluded.length,
    acceptedRecords: accepted, excluded,
    sourceStatus: Object.entries(manifest.source).every(([key, value]) => key === 'provider' || value === 'VERIFIED')
      ? 'SOURCE_EVIDENCE_RECORDED' : 'BLOCKED',
    readyForForwardCollection: Object.entries(manifest.source).every(([key, value]) => key === 'provider' || value === 'VERIFIED'),
    eligibleForProduction: false,
    requiresOfficialTradingCalendarVerification: true,
    outcomeWinRate: null,
    note: 'No realized forward performance without an independently frozen, completed future-outcome ledger.',
  };
}
