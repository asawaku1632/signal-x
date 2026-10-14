import {gradeForward, summarize, VERSION} from './bollingerBreakoutShadow.mjs';

export const ARCHIVE_QUALITY_VERSION = 'BB_BREAKOUT_ARCHIVE_QUALITY_V1';
const MAX_STOCKS = 5;
const MAX_BARS_PER_STOCK = 550;
const MAX_EVENTS_PER_STOCK = 550;
const LOOKBACK_BARS = 80;
const MAX_HORIZON = 5;

function dateJst(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const d = new Date(seconds * 1000);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}) : null;
}
function validBar(x) {
  return x && [x.time,x.open,x.high,x.low,x.close].every(v=>typeof v==='number'&&Number.isFinite(v))
    && Number.isSafeInteger(x.time) && x.time>0 && x.open>0 && x.low>0 && x.close>0
    && x.high>=Math.max(x.open,x.close) && x.low<=Math.min(x.open,x.close)
    && (x.volume===undefined||(Number.isFinite(x.volume)&&x.volume>=0));
}
function stringDates(a) {
  return Array.isArray(a) && a.every(d=>typeof d==='string'
    && /^\d{4}-\d{2}-\d{2}$/.test(d)
    && new Date(d+'T00:00:00.000Z').toISOString().slice(0,10)===d);
}
function uniqueAndOrdered(xs) {
  return xs.every((v,i)=>!i || xs[i-1]<v);
}
/** Trusted upstream supplies the full official JPX trading-day sequence.
 * A missing holiday/calendar coverage is a hard stop, never a silent skipped bar.
 * No data fetching and no source manipulation happen in this function.
 */
export function validateCompletedArchive(item) {
  if(!item||!/^[0-9]{4}$/.test(item.code??''))return {ok:false,reason:'INVALID_CODE'};
  if(item.provider!=='YAHOO_CHART'||item.timeframe!=='1D')
    return {ok:false,reason:'PROVENANCE_UNCONFIRMED'};
  if(!Array.isArray(item.candles)||item.candles.length<LOOKBACK_BARS+1
    ||item.candles.length>MAX_BARS_PER_STOCK)return {ok:false,reason:'INVALID_BAR_COUNT'};
  if(!Array.isArray(item.splitEvents)||!item.splitEvents.every(x=>Number.isSafeInteger(x)&&x>0)
    ||!uniqueAndOrdered(item.splitEvents))return {ok:false,reason:'SPLIT_EVENTS_UNCONFIRMED'};
  if(!stringDates(item.expectedTradingDates)
    ||item.expectedTradingDates.length!==item.candles.length
    ||!uniqueAndOrdered(item.expectedTradingDates))return {ok:false,reason:'CALENDAR_UNCONFIRMED'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.asOfCompletedJstDate??''))
    return {ok:false,reason:'AS_OF_UNCONFIRMED'};
  let previousTime=0;
  for(let i=0;i<item.candles.length;i++){
    const b=item.candles[i];
    if(!validBar(b)||b.time<=previousTime)return {ok:false,reason:'INVALID_OHLC'};
    previousTime=b.time;
    if(dateJst(b.time)!==item.expectedTradingDates[i])
      return {ok:false,reason:'CALENDAR_GAP_OR_DUPLICATE'};
    // A daily bar is only eligible when completed before an externally asserted cutoff.
    if(item.expectedTradingDates[i]>item.asOfCompletedJstDate)
      return {ok:false,reason:'UNCOMPLETED_BAR_INCLUDED'};
  }
  return {ok:true,reason:null,stockCount:1,barCount:item.candles.length,
    lastDate:item.expectedTradingDates.at(-1)};
}
function actionBetween(eventTimes,first,last) {
  return eventTimes.some(ts=>ts>=first&&ts<=last);
}
/** Historical single-stock grading. Retrospective split-exclusion is a quality
 * filter, not an as-of signal input. Does not persist or schedule any work.
 */
export function studyCompletedArchiveStock(item) {
  const quality=validateCompletedArchive(item);
  if(!quality.ok)return {code:item?.code??null,quality,records:[],exclusions:{}};
  const records=[],exclusions={SPLIT_AFFECTED:0,PENDING:0};
  for(let t=LOOKBACK_BARS;t<item.candles.length;t++){
    const r=gradeForward(item.candles,t,item.code);
    if(!r.signal.eligible || !r.signal.breakout)continue;
    if(records.length>=MAX_EVENTS_PER_STOCK)throw Error('EVENT_CAP_EXCEEDED');
    const end=Math.min(t+MAX_HORIZON,item.candles.length-1);
    if(actionBetween(item.splitEvents,item.candles[t-LOOKBACK_BARS].time,item.candles[end].time)){
      exclusions.SPLIT_AFFECTED++;
      continue;
    }
    if(t+MAX_HORIZON>=item.candles.length)exclusions.PENDING++;
    records.push(r);
  }
  return {code:item.code,quality,records,exclusions};
}
export function studyCompletedArchiveCohort(items) {
  if(!Array.isArray(items)||items.length<1||items.length>MAX_STOCKS)
    throw Error('COHORT_SIZE_REJECTED');
  const seen=new Set();
  for(const x of items){
    if(seen.has(x?.code))throw Error('DUPLICATE_STOCK');
    seen.add(x?.code);
  }
  const stocks=items.map(studyCompletedArchiveStock);
  const records=stocks.flatMap(s=>s.records);
  // Entire reported cohort fails closed on any invalid stock, not a biased subset.
  const complete=stocks.every(s=>s.quality.ok);
  return {
    qualityVersion:ARCHIVE_QUALITY_VERSION,signalVersion:VERSION,
    status:complete?'READY_FOR_SHADOW_COMPARISON':'DATA_QUALITY_REJECTED',
    stockCount:stocks.length,
    quality:stocks.map(s=>({code:s.code,...s.quality,exclusions:s.exclusions,events:s.records.length})),
    summary:complete?summarize(records):null
  };
}
