/**
 * Source-availability proof for the 09:08 owner-only morning shadow.
 *
 * Yahoo's 5m timestamps are bar STARTS. 09:00 OHLCV is safe only after 09:05;
 * 09:05 OPEN may be inspected after its start, but its high/low/close/volume
 * MUST NEVER enter an as-of 09:08 classifier. This is a provider response
 * receipt audit, not an official quote or a fillable bid/ask.
 */
export const OPENING_SOURCE_AUDIT_VERSION = "MORNING_0908_YAHOO_SOURCE_AUDIT_V1";
const SOURCE = "YAHOO_V8_CHART_5M";
const validDate = x => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x+"T00:00:00Z")) &&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10) === x;
const positive = x => typeof x === "number" && Number.isFinite(x) && x > 0;
const volume = x => typeof x === "number" && Number.isFinite(x) && x >= 0;
const jst = value => {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(d);
  const part = name => parts.find(p=>p.type===name)?.value ?? "";
  return {date:part("year")+"-"+part("month")+"-"+part("day"),
    hhmm:part("hour")+":"+part("minute"),
    minute:Number(part("hour"))*60+Number(part("minute"))};
};
const milliseconds = x => {
  if (!(x instanceof Date) && (typeof x !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(x))) return NaN;
  return new Date(x).getTime();
};

/**
 * Returns only sanitized 09:00 OHLCV and 09:05 OPEN.
 * Missing/invalid evidence is never converted to SKIP or BUY_CANDIDATE.
 * Evidence is suitable for storing with the immutable morning observation.
 */
export function auditYahooOpeningAsOf({
  payload, tradeDate, requestedAt, receivedAt,
} = {}) {
  if (!validDate(tradeDate)) throw Error("INVALID_TRADE_DATE");
  const requestMs = milliseconds(requestedAt), receiptMs = milliseconds(receivedAt);
  const req = Number.isFinite(requestMs) ? new Date(requestMs).toISOString() : null;
  const rec = Number.isFinite(receiptMs) ? new Date(receiptMs).toISOString() : null;
  const chart = payload?.chart?.result?.[0];
  const timezone = chart?.meta?.exchangeTimezoneName ?? null;
  const evidence = {
    version:OPENING_SOURCE_AUDIT_VERSION,source:SOURCE,
    tradeDate,requestedAt:req,receivedAt:rec,exchangeTimezone:timezone,
    requiredSlots:["09:00","09:05"],observedSlots:[],missingSlots:[],
    status:"UNAVAILABLE",reason:null,
    executableFillVerified:false,officialSourceVerified:false,
  };
  const unavailable = reason => ({
    bars:[],evidence:{...evidence,status:"UNAVAILABLE",reason},
  });
  const reqJst = Number.isFinite(requestMs)?jst(requestMs):null;
  const recJst = Number.isFinite(receiptMs)?jst(receiptMs):null;
  if (!reqJst || !recJst || requestMs>receiptMs ||
      reqJst.date!==tradeDate || recJst.date!==tradeDate ||
      reqJst.minute < 9*60+8 || reqJst.minute >= 9*60+19 ||
      recJst.minute < 9*60+8 || recJst.minute >= 9*60+19) {
    return unavailable("OUTSIDE_0908_CAPTURE_WINDOW");
  }
  if (timezone!=="Asia/Tokyo") return unavailable("UNVERIFIED_EXCHANGE_TIMEZONE");
  const timestamps=chart?.timestamp, q=chart?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || timestamps.length>240 || !q ||
      !Array.isArray(q.open) || !Array.isArray(q.high) ||
      !Array.isArray(q.low) || !Array.isArray(q.close) ||
      !Array.isArray(q.volume)) return unavailable("INVALID_CHART_RESPONSE");
  const relevant = new Map();
  let duplicate = false;
  for (let i=0;i<timestamps.length;i++) {
    const time=timestamps[i];
    if (!Number.isSafeInteger(time) || time<=0 || time%300!==0) continue;
    const stamp=jst(time*1000);
    if (stamp?.date!==tradeDate ||
        (stamp.hhmm!=="09:00" && stamp.hhmm!=="09:05")) continue;
    // Upstream may include an unfinished/future bar. Never count it as known.
    if (time*1000>receiptMs) continue;
    if (relevant.has(stamp.hhmm)) {duplicate=true;continue;}
    relevant.set(stamp.hhmm,{time,i});
  }
  evidence.observedSlots=[...relevant.keys()].sort();
  evidence.missingSlots=evidence.requiredSlots.filter(x=>!relevant.has(x));
  if (duplicate) return unavailable("DUPLICATE_OPENING_SLOTS");
  if (evidence.missingSlots.length===2) return unavailable("MISSING_BOTH_OPENING_SLOTS");
  if (evidence.missingSlots.includes("09:00")) return unavailable("MISSING_0900_BAR");
  if (evidence.missingSlots.includes("09:05")) return unavailable("MISSING_0905_BAR");
  const one=relevant.get("09:00"), two=relevant.get("09:05");
  if (two.time-one.time!==300 || one.time*1000+300000>receiptMs)
    return unavailable("INCOMPLETE_OR_MISALIGNED_OPENING_BAR");
  const first={
    time:one.time,open:q.open[one.i],high:q.high[one.i],
    low:q.low[one.i],close:q.close[one.i],volume:q.volume[one.i],
  };
  const second={time:two.time,open:q.open[two.i],
    high:null,low:null,close:null,volume:null};
  if (!positive(first.open) || !positive(first.high) ||
      !positive(first.low) || !positive(first.close) || !volume(first.volume) ||
      first.low>first.high || first.high<Math.max(first.open,first.close) ||
      first.low>Math.min(first.open,first.close))
    return unavailable("INVALID_0900_OHLCV");
  if (!positive(second.open)) return unavailable("INVALID_0905_OPEN");
  return {bars:[first,second],evidence:{
    ...evidence,status:"AVAILABLE_AS_OF_RECEIPT",reason:null,
  }};
}
