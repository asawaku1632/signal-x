// STEP27 research-only, offline freshness evaluator. No network, storage, scheduling or production imports.
// This file does not authorize use of any market data provider.
const jst = d => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d);
export function evaluateN225Chart(payload, at = new Date()) {
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) return {status:'invalid',reason:'INVALID_CHECK_TIME'};
  const results = payload?.chart?.result;
  if (!Array.isArray(results) || results.length !== 1) return {status:'invalid',reason:'RESULT_FORMAT'};
  const r = results[0];
  if (r?.meta?.symbol !== '^N225') return {status:'invalid',reason:'SYMBOL_MISMATCH'};
  const timestamps = r?.timestamp, closes = r?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes) || !timestamps.length || timestamps.length !== closes.length)
    return {status:'invalid',reason:'BAR_ARRAY_FORMAT'};
  const i = timestamps.length - 1, ts = timestamps[i], close = closes[i];
  if (!Number.isSafeInteger(ts) || ts <= 0 || !Number.isFinite(ts*1000))
    return {status:'invalid',reason:'LATEST_TIMESTAMP_INVALID'};
  const observed = new Date(ts*1000);
  if (!Number.isFinite(observed.getTime())) return {status:'invalid',reason:'LATEST_TIMESTAMP_INVALID'};
  const observedAtJst = jst(observed);
  const ageMinutes = (at.getTime() - observed.getTime()) / 60000;
  const detail = {observedAtJst,ageMinutes:Number(ageMinutes.toFixed(3))};
  if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return {status:'invalid',reason:'LATEST_CLOSE_INVALID',...detail};
  if (ageMinutes < 0) return {status:'invalid',reason:'FUTURE_BAR',...detail};
  if (jst(at).slice(0,10) !== observedAtJst.slice(0,10) || ageMinutes > 20)
    return {status:'stale',reason:'OLD_BAR',...detail};
  return {status:'observed',reason:'FRESH',...detail};
}
export const step27Policy = Object.freeze({
  mode:'research_only', source:'licensed-provider-pending',
  liveFetchEnabled:false, databaseWriteEnabled:false,
  cronEnabled:false, productionIntegrationEnabled:false
});
