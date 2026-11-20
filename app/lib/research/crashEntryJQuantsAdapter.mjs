/** Offline adapter: reconciled private J-Quants archive -> next-session slot references.
 * Research only. No network, persistence, orders or alerts.
 */
import {reconcileCapturedTradeDay} from './fourPatternJQuantsBridge.mjs';
import {compareEntrySlots} from './crashResilienceV2.mjs';
const slots=Object.freeze([['09:20',560],['11:20',680],['14:15',855]]);
const dayOK=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const codeOK=s=>typeof s==='string'&&/^[0-9]{3}[0-9A-Z]$/.test(s);
/** A single one-minute candle is a reference, NOT a guaranteed execution. */
export function studyCrashEntryArchive({signalDate,tradeDate,code,archive,exitClose=null}){
 if(!dayOK(signalDate)||!dayOK(tradeDate)||tradeDate<=signalDate||!codeOK(code)||
  !archive||archive.code!==code)throw Error('INVALID_CRASH_ENTRY_ARCHIVE_TARGET');
 const minuteDay=archive.minuteDays?.find(x=>x.date===tradeDate);
 const dailyDay=archive.dailyDays?.find(x=>x.date===tradeDate);
 if(!minuteDay||!dailyDay) return {status:'MISSING_RECONCILED_TRADE_DAY',code,signalDate,tradeDate,slots:[]};
 const validated=reconcileCapturedTradeDay({
  code,date:tradeDate,minutePages:minuteDay.pages,dailyPages:dailyDay.pages
 });
 const timestamp=new Date(validated.capturedAt*1000).toISOString();
 const references=slots.flatMap(([slot,minute])=>{
  const row=validated.minutes.find(x=>x.minute===minute);
  return row?[{slot,tradeDate,price:row.close,
   sourceTimestamp:tradeDate+'T'+slot+':00+09:00',capturedAt:timestamp}]:[];
 });
 const compared=compareEntrySlots({signalDate,code,slots:references,exitClose});
 return {status:'HISTORICAL_REFERENCE_ONLY',code,signalDate,tradeDate,
  observedMinutes:validated.minuteBarCount,slots:compared,
  assumptions:'1m close at exact minute; no guarantee of fill; historical receipt not contemporaneous; exitClose externally supplied'};
}
