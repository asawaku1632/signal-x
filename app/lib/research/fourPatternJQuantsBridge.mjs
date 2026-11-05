/**
 * SHADOW ONLY — offline, point-in-time defensive bridge from retained
 * J-Quants V2 minute/daily/financial response pages to fourStrategyShadow.
 * No network, credentials, storage, scoring, orders, notifications or cron.
 */
import { studyFourPatterns } from './fourStrategyShadow.mjs';

export const FOUR_PATTERN_JQUANTS_BRIDGE_VERSION = 'four_pattern_jquants_bridge_v1';
export const BRIDGE_LIMITS = Object.freeze({
  maxDays: 35, maxPagesPerDay: 4, maxFinancialPages: 8,
  maxMinuteRowsPerDay: 327, maxFinancialRows: 600,
});
const codeOK = s => typeof s === 'string' && /^[0-9]{3}[0-9A-Z]$/.test(s);
const codeMatch = (value, code) => value === code || value === code + '0';
const dayOK = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const number = x => typeof x === 'number' && Number.isFinite(x);
const positive = x => number(x) && x > 0;
const receipt = x => typeof x === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) ?
  Date.parse(x) : NaN;
const fail = status => { throw new TypeError(status); };
const utcJst = (day, hhmmss) => Date.parse(day + 'T' + hhmmss + '+09:00');
const approx = (x, y) => Math.abs(x - y) <= 1e-8 * Math.max(1, Math.abs(x), Math.abs(y));

/** Caller supplies exactly the full set of previously captured API pages. */
export function auditCapturedPages(pages, maxPages, maxRows, earliestReceiptMs = 0) {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > maxPages)
    fail('MISSING_OR_EXCESS_PAGES');
  let expected = null, previous = -Infinity, last = null;
  const tokens = new Set(), rows = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i], r = p?.response;
    if (!p || !Object.prototype.hasOwnProperty.call(p, 'requestPaginationKey'))
      fail('MISSING_PAGINATION_REQUEST');
    const timestamp = receipt(p.receivedAt);
    if (!Number.isFinite(timestamp) || timestamp < earliestReceiptMs || timestamp < previous)
      fail('INVALID_OR_TOO_EARLY_CAPTURE');
    previous = timestamp;
    last = timestamp;
    if (p.requestPaginationKey !== expected) fail('BROKEN_PAGINATION_CHAIN');
    if (!r || !Array.isArray(r.data)) fail('INVALID_PROVIDER_RESPONSE');
    rows.push(...r.data);
    if (rows.length > maxRows) fail('EXCESS_PROVIDER_ROWS');
    const next = r.pagination_key === '' || r.pagination_key == null ? null : r.pagination_key;
    if (next !== null && (typeof next !== 'string' || next.length > 200 ||
        next === expected || tokens.has(next))) fail('INVALID_PAGINATION_TOKEN');
    if (next !== null) tokens.add(next);
    expected = next;
    if (next === null && i !== pages.length - 1) fail('PAGES_AFTER_TERMINAL');
  }
  if (expected !== null) fail('INCOMPLETE_PAGINATION');
  return { rows, lastReceivedAt: Math.floor(last / 1000) };
}
function minuteOf(t) {
  if (typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return -1;
  const [h,m] = t.split(':').map(Number);
  const minutes = h * 60 + m;
  return (minutes >= 540 && minutes <= 690) ||
    (minutes >= 750 && minutes <= 924) || minutes === 930 ? minutes : -1;
}
function dailyActual(row, code, date) {
  if (!row || !codeMatch(row.Code, code) || row.Date !== date)
    fail('WRONG_DAILY_CODE_OR_DATE');
  if (row.ExRT !== null || row.AdjFactor !== 1)
    fail('MISSING_OR_NONUNIT_CORPORATE_ACTION_METADATA');
  if (![row.O,row.H,row.L,row.C].every(positive) ||
      !Number.isSafeInteger(row.Vo) || row.Vo <= 0 ||
      row.H < Math.max(row.O,row.L,row.C) ||
      row.L > Math.min(row.O,row.H,row.C))
    fail('INVALID_UNADJUSTED_DAILY_OHLCV');
  return row;
}
/** One security and one date. Validated complete minute+daily pagination required. */
export function reconcileCapturedTradeDay({ code, date, minutePages, dailyPages }) {
  if (!codeOK(code) || !dayOK(date)) fail('INVALID_CODE_OR_DAY');
  const floor = utcJst(date, '16:30:00');
  const minutes = auditCapturedPages(minutePages, BRIDGE_LIMITS.maxPagesPerDay,
    BRIDGE_LIMITS.maxMinuteRowsPerDay, floor);
  const day = auditCapturedPages(dailyPages, BRIDGE_LIMITS.maxPagesPerDay, 3, floor);
  if (day.rows.length !== 1) fail('DAILY_RECORD_COUNT_NOT_ONE');
  const official = dailyActual(day.rows[0], code, date);
  const observed = new Set(), rows = [];
  for (const b of minutes.rows) {
    const min = minuteOf(b?.Time);
    if (b?.Date !== date || !codeMatch(b.Code, code) || min < 0)
      fail('WRONG_MINUTE_CODE_DATE_OR_SESSION');
    if (observed.has(min)) fail('DUPLICATE_MINUTE');
    observed.add(min);
    if (![b.O,b.H,b.L,b.C,b.Va].every(positive) ||
        !Number.isSafeInteger(b.Vo) || b.Vo <= 0 ||
        b.H < Math.max(b.O,b.C,b.L) || b.L > Math.min(b.O,b.C,b.H) ||
        b.Va < b.L * b.Vo * 0.99 || b.Va > b.H * b.Vo * 1.01)
      fail('INVALID_MINUTE_OHLCV_TURNOVER');
    rows.push({ date, minute: min, open:b.O, high:b.H, low:b.L, close:b.C,
      volume:b.Vo, turnover:b.Va });
  }
  rows.sort((a,b)=>a.minute-b.minute);
  if (!rows.length) fail('NO_EXECUTED_MINUTE_ROWS');
  const first=rows[0], last=rows.at(-1);
  const sumVolume=rows.reduce((s,x)=>s+x.volume,0);
  if (!Number.isSafeInteger(sumVolume) ||
      !approx(first.open,official.O) ||
      !approx(Math.max(...rows.map(x=>x.high)),official.H) ||
      !approx(Math.min(...rows.map(x=>x.low)),official.L) ||
      !approx(last.close,official.C) || sumVolume !== official.Vo)
    fail('UNADJUSTED_MINUTE_DAILY_MISMATCH');
  return { date, code, minutes: rows,
    minuteBarCount: rows.length, dailyMatched: true,
    capturedAt: Math.max(minutes.lastReceivedAt,day.lastReceivedAt),
    noTradeMinutesImputed: false, intradayAvailabilityVerified: false };
}
function barSlot(minute, width) {
  const morning = minute <= 690;
  const start = morning ? 540 : 750;
  // Opening/closing auction minute belongs to the preceding terminal bucket.
  const offset = minute === 690 ? 149 : minute === 930 ? 179 : minute - start;
  const slot = Math.floor(offset / width);
  const bucketMin = start + slot * width;
  const last = morning ? 690 : 930;
  const endMinute = Math.min(bucketMin + width, last + 1);
  return {startMinute:bucketMin, endMinute};
}
function clockTime(minutes) {
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'+
    String(minutes%60).padStart(2,'0')+':00';
}
/** 30 and 60-minute prices are only usable after their bucket closes. */
export function aggregateReconciledMinutes(days, width) {
  if (width !== 30 && width !== 60) fail('UNSUPPORTED_TIMEFRAME');
  if (!Array.isArray(days) || !days.every(d => d?.dailyMatched === true &&
      Array.isArray(d.minutes))) fail('UNRECONCILED_DAY');
  const bars=[];
  for (const day of days) {
    let previous = null;
    for (const b of day.minutes) {
      const slot = barSlot(b.minute,width);
      const key = slot.startMinute;
      if (previous?.key !== key) {
        previous = { key, date:day.date,
          time:Math.floor(utcJst(day.date,clockTime(slot.endMinute))/1000),
          open:b.open,high:b.high,low:b.low,close:b.close,
          volume:b.volume,turnover:b.turnover };
        bars.push(previous);
      } else {
        previous.high=Math.max(previous.high,b.high);
        previous.low=Math.min(previous.low,b.low);
        previous.close=b.close;
        previous.volume+=b.volume;
        previous.turnover+=b.turnover;
      }
    }
  }
  return bars.map(({key,date,turnover,...b}) => ({...b,barDate:date}));
}
const signedNumber = value => typeof value === 'string' && value.trim() !== '' &&
  /^-?(?:\d+)(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ?
  Number(value) : null;
const periodYearEarlier = date => {
  const [y,m,d]=date.split('-').map(Number);
  const prev=String(y-1)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  return dayOK(prev) ? prev : null;
};
function discTimestamp(row) {
  if (!dayOK(row?.DiscDate) ||
      typeof row.DiscTime !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d:00$/.test(row.DiscTime)) return NaN;
  return utcJst(row.DiscDate,row.DiscTime);
}
/**
 * Conservatively gate financial features to the moment the entire response
 * was RECEIVED, even when disclosure occurred much earlier. A historical
 * bulk fetch today is NOT evidence that our app knew it last year.
 */
export function convertCapturedFinancialSummary({code, pages}) {
  if (!codeOK(code)) fail('INVALID_FINANCIAL_CODE');
  if (pages === undefined || pages === null) return {
    status:'NO_FINANCIAL_ARCHIVE', fundamentals:[], excluded:0 };
  const {rows,lastReceivedAt}=auditCapturedPages(pages,BRIDGE_LIMITS.maxFinancialPages,
    BRIDGE_LIMITS.maxFinancialRows);
  const list=[], keys=new Set();
  for (const r of rows) {
    if (!codeMatch(r?.Code,code)) fail('FINANCIAL_WRONG_CODE');
    const disclosedAt=discTimestamp(r), date=r?.CurPerEn;
    if (!Number.isFinite(disclosedAt) || !r?.DiscNo ||
        typeof r.DiscNo !== 'string') fail('INVALID_DISCLOSURE_METADATA');
    if (Math.floor(disclosedAt/1000) > lastReceivedAt)
      fail('DISCLOSURE_LATER_THAN_ARCHIVE_RECEIPT');
    if (keys.has(r.DiscNo)) fail('DUPLICATE_DISCLOSURE_NUMBER');
    keys.add(r.DiscNo);
    // Forecast-only / dividend-only rows may legitimately omit period end.
    if (!['FY','1Q','2Q','3Q'].includes(r.CurPerType)) continue;
    if (!dayOK(date)) continue;
    const sales=signedNumber(r.Sales), op=signedNumber(r.OP);
    const cfo=signedNumber(r.CFO), equityRatio=signedNumber(r.EqAR);
    list.push({disclosedAt:Math.floor(disclosedAt/1000),
      availableAt:Math.max(Math.floor(disclosedAt/1000),lastReceivedAt),
      no:r.DiscNo, type:r.CurPerType, date,
      sales,op,cfo,equityRatio});
  }
  list.sort((a,b)=>a.disclosedAt-b.disclosedAt || a.no.localeCompare(b.no));
  const fundamentals=[];
  for (const current of list) {
    const priorDate=periodYearEarlier(current.date);
    if (!priorDate || !positive(current.sales) || !positive(current.op) ||
        !positive(current.cfo) || current.equityRatio === null) continue;
    const prior=list.filter(p=>p.type===current.type && p.date===priorDate &&
      p.disclosedAt<=current.disclosedAt && positive(p.sales) && positive(p.op))
      .at(-1);
    if (!prior) continue;
    const growthSales=(current.sales/prior.sales-1)*100;
    const growthOp=(current.op/prior.op-1)*100;
    if (![growthSales,growthOp].every(Number.isFinite) ||
        growthSales > 100000 || growthOp > 100000) continue;
    fundamentals.push({
      publishedAt: current.availableAt,
      revenueGrowthPct: Number(growthSales.toFixed(4)),
      operatingProfitGrowthPct: Number(growthOp.toFixed(4)),
      equityRatioPct: Number((current.equityRatio*100).toFixed(4)),
      operatingCashFlowYen:current.cfo,
      disclosureEpoch:current.disclosedAt,
      captureEpoch:lastReceivedAt,source:'JQUANTS_FINS_SUMMARY_CAPTURED_AT_RECEIPT',
      currentDisclosureNo:current.no,priorDisclosureNo:prior.no,
    });
  }
  return {status:'CAPTURE_GATED_FINANCIAL_ONLY', fundamentals,
    inputDisclosures:list.length, excluded:list.length-fundamentals.length,
    captureEpoch:lastReceivedAt, disclosureIsNotProviderAvailability:true};
}
export function studyCapturedJQuantsFourPatterns({
  code, minuteDays, dailyDays, financialPages=null, timeframe='30m',
}={}) {
  const blocked=reason=>({
    version:FOUR_PATTERN_JQUANTS_BRIDGE_VERSION,code, timeframes:[],
    status:'BLOCKED_'+reason, reports:[], financialStatus:'NOT_EVALUATED',
    eligibleForProduction:false, eligibleForNotifications:false,
  });
  try {
    if (!codeOK(code) || !['30m','60m','BOTH'].includes(timeframe))
      fail('INVALID_PARAMETERS');
    if (!Array.isArray(minuteDays) || !Array.isArray(dailyDays) ||
        minuteDays.length < 1 || minuteDays.length > BRIDGE_LIMITS.maxDays ||
        dailyDays.length !== minuteDays.length)
      fail('INVALID_DATE_COVERAGE');
    const unique=new Set(), reconciled=[];
    for (let i=0;i<minuteDays.length;i++) {
      const m=minuteDays[i], d=dailyDays[i];
      if (!dayOK(m?.date) || !dayOK(d?.date) || m.date !== d.date ||
          unique.has(m.date) || (i && m.date<=minuteDays[i-1].date))
        fail('UNSORTED_DUPLICATE_OR_UNPAIRED_DATES');
      unique.add(m.date);
      reconciled.push(reconcileCapturedTradeDay({
        code,date:m.date,minutePages:m.pages,dailyPages:d.pages }));
    }
    const finances=convertCapturedFinancialSummary({code,pages:financialPages});
    const timeframes=timeframe==='BOTH'?['30m','60m']:[timeframe];
    const reports=timeframes.map(tf=>{
      const candles=aggregateReconciledMinutes(reconciled, tf==='30m'?30:60);
      return {timeframe:tf,report:studyFourPatterns({
        code,timeframe:tf,candles,fundamentals:finances.fundamentals,
        source:'JQUANTS_V2_RECONCILED_HISTORICAL_CAPTURE_ONLY',
      })};
    });
    return {version:FOUR_PATTERN_JQUANTS_BRIDGE_VERSION,code,
      status:'HISTORICAL_RECONCILED_SHADOW_ONLY',timeframes,
      reconciledDates:reconciled.map(x=>x.date),
      verifiedMinuteDays:reconciled.length,
      capturedOriginalMinutes:reconciled.reduce((s,d)=>s+d.minuteBarCount,0),
      financialStatus:finances.status,
      financialAsOfSnapshots:finances.fundamentals.length,
      financialExcluded:finances.excluded,
      reports, eligibleForProduction:false,eligibleForNotifications:false,
      actualDecisionTimeDataAvailabilityVerified:false,
      sourceRightsIndependentlyVerified:false,
      notes:[
        'Minute data captured after the session is historical, not a live 09:05 or 09:15 feed.',
        'Missing minute intervals are NOT interpolated. Both auctions remain in final session buckets.',
        'Financial features require a prior comparable period and are gated to the archive receipt time.',
        'No profitability, future forward-trading validity or license rights are certified.',
      ]};
  } catch(error) {
    const reason=error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ?
      error.message : 'UNKNOWN_DATA_ERROR';
    return blocked(reason);
  }
}
