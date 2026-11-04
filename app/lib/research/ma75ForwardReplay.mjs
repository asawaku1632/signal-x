/** Pure prospective as-of price-bar replayer. NO API, storage, cron or signals. */
import { verifyMa75ForwardManifest, auditMa75ForwardEvidence } from './ma75ForwardProtocol.mjs';
export const MA75_FORWARD_REPLAY_VERSION = 'ma75_forward_bar_replay_v1';
const day = unix => Number.isSafeInteger(unix) && unix > 0
  ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const avg = values => values.reduce((a, b) => a + b, 0) / values.length;
const round = value => Number(value.toFixed(5));
const dailyBarValid = c => c && ['time','open','high','low','close','volume'].every(k => finite(c[k])) &&
  Number.isSafeInteger(c.time) && c.time > 0 && c.open > 0 && c.close > 0 &&
  c.low > 0 && c.high >= Math.max(c.low,c.open,c.close) && c.low <= Math.min(c.open,c.close) &&
  c.volume >= 0;
/**
 * Only *already completed* input bars are accepted; entry and outcome must
 * not be inferred. This is a trace/replay audit, NOT source certification.
 * Independent official trading-calendar and provider licence checks remain blocked.
 */
export function replayMa75ForwardBars(manifest, cohorts) {
  if (!verifyMa75ForwardManifest(manifest) || !Array.isArray(cohorts))
    throw new TypeError('Invalid freeze manifest or forward bar inputs');
  const seen = new Set();
  const accepted = [], excluded = [];
  for (const data of cohorts) {
    const code = data?.code, tradeDate = data?.tradeDate;
    const id = String(code ?? '?')+':'+String(tradeDate ?? '?');
    let reason = null;
    if (!manifest.codes.includes(code)) reason = 'NOT_FROZEN_COHORT';
    else if (typeof tradeDate !== 'string' || tradeDate < manifest.firstSignalDate ||
      !/^20\d\d-\d\d-\d\d$/.test(tradeDate)) reason = 'BEFORE_FROZEN_START';
    else if (seen.has(id)) reason = 'DUPLICATE_CODE_DAY';
    else {
      seen.add(id);
      const bars = data.candles;
      if (data.timeframe !== '1D' || !Array.isArray(bars) || bars.length < 76)
        reason = 'INSUFFICIENT_DAILY_BARS';
      else if (!bars.every(dailyBarValid) ||
        bars.some((bar, i) => i > 0 && (bar.time <= bars[i-1].time || day(bar.time) === day(bars[i-1].time))))
        reason = 'INVALID_OR_UNSORTED_BARS';
      else if (day(bars[bars.length - 1].time) !== tradeDate)
        reason = 'MISSING_OR_FUTURE_LAST_BAR';
      else if (bars.slice(-76).some((bar, i, group) => i > 0 &&
        Math.abs(bar.close / group[i-1].close - 1) > 0.45))
        reason = 'SPLIT_OR_DISCONTINUITY_UNVERIFIED';
      else {
        const n = bars.length - 1;
        const sma75 = avg(bars.slice(n-74, n+1).map(b => b.close));
        const priorSma75 = avg(bars.slice(n-75, n).map(b => b.close));
        const vol20 = bars.slice(n-20, n).map(b => b.volume);
        const ratio = vol20.every(v => v > 0) && bars[n].volume > 0 ? bars[n].volume/avg(vol20) : null;
        const trace = auditMa75ForwardEvidence(manifest,[{
          code,tradeDate,barClosedAt: data.barClosedAt,barCapturedAt:data.barCapturedAt,
          featuresCapturedAt:data.featuresCapturedAt,signalRecordedAt:data.signalRecordedAt,
          nextOpenAt:data.nextOpenAt,sourceProvider:data.sourceProvider,
          signalClose:bars[n].close,priorClose:bars[n-1].close,sma75,priorSma75,
        }]);
        if (!trace.accepted) reason = trace.excluded[0].reason;
        else accepted.push({id,code,tradeDate,signalRecordedAt:data.signalRecordedAt,
          closingPrice:bars[n].close,sma75:round(sma75),
          sma75Rising:sma75>priorSma75,volumeRatio:ratio===null?null:round(ratio),
          variantMatches:{BREAKOUT_ALL:true,BREAKOUT_SMA75_RISING:sma75>priorSma75,
            BREAKOUT_VOLUME_1_5:ratio!==null && ratio>=1.5,
            BREAKOUT_BOTH:sma75>priorSma75 && ratio!==null && ratio>=1.5},
          outcomeStatus:'NOT_YET_OBSERVED'});
      }
    }
    if (reason) excluded.push({id,reason});
  }
  return {version:MA75_FORWARD_REPLAY_VERSION,manifestSha256:manifest.manifestSha256,
    examined:cohorts.length,accepted:accepted.length,rejected:excluded.length,
    candidates:accepted,excluded,eligibleForProduction:false,
    verifiedSourceRights:manifest.source.usageRights==='VERIFIED' &&
      manifest.source.corporateActions==='VERIFIED' && manifest.source.timestampProvenance==='VERIFIED',
    outOfSampleWinRate:null,completedFutureOutcomes:0,
    note:'No live data fetch, verified trading calendar, broker fill, forward returns, or production activation.'};
}
