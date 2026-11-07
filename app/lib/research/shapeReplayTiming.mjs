const day=ms=>new Date(ms).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const minute=ms=>{const d=new Date(ms+9*3600000);return d.getUTCHours()*60+d.getUTCMinutes();};
/** Reference cutoff only; saved snapshot time is not the original scan start. */
export function shapeReplayPolicy(savedAt,barTimestamp,source){
 const saved=Date.parse(savedAt);
 if(!Number.isFinite(saved))return null;
 const bar=typeof barTimestamp==="number"?barTimestamp*1000:NaN;
 const known=Number.isFinite(bar)&&bar>0&&bar<=saved;
 const anchor=known?day(bar):day(saved);
 const afterClose=saved>=Date.parse(anchor+"T16:00:00+09:00");
 const includeAnchor=known&&afterClose&&(
  (source==="intraday"&&minute(bar)>=15*60+30)||source==="daily_fallback");
 return {anchor,includeAnchor,sourceLabel:source==="intraday"?"5分足":source==="daily_fallback"?"日足（代替取得）":"足種不明",
  barTimestamp:known?barTimestamp:null};
}
export function shapeReferenceCandles(candles,policy){
 if(!policy)return [];
 return candles.filter(c=>{const d=day(c.time*1000);return d<policy.anchor||(policy.includeAnchor&&d===policy.anchor);});
}
export function closedReferenceCandles(candles,nowMs){
 const today=day(nowMs),includeToday=minute(nowMs)>=16*60;
 return candles.filter(c=>{const d=day(c.time*1000);return d<today||(includeToday&&d===today);});
}
