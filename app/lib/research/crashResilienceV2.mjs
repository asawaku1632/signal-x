/** CRASH_RESILIENCE_V2: pure offline research, never a trading signal. */
export const HORIZONS=Object.freeze([1,3,5,10]);
const finitePositive=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))&&Number(v)>0;
const pct=(a,b)=>(b/a-1)*100;
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2};
const dateOk=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
export function analyzeCrashResilienceV2({market=[],stocks=[],asOf,minimumCoverage=800}){
 if(!dateOk(asOf))throw Error("INVALID_AS_OF");
 if(!Number.isInteger(minimumCoverage)||minimumCoverage<1)throw Error("INVALID_COVERAGE");
 const marketByDate=new Map();
 for(const m of market){
  if(!dateOk(m.date)||m.date>=asOf||!finitePositive(m.topix)||marketByDate.has(m.date))continue;
  marketByDate.set(m.date,Number(m.topix));
 }
 const dates=[...marketByDate.keys()].sort();
 const byDate=new Map();
 for(const s of stocks){
  if(!dateOk(s.date)||s.date>=asOf||!/^\d{4}$/.test(String(s.code))||!finitePositive(s.close))continue;
  if(!byDate.has(s.date))byDate.set(s.date,new Map());
  if(!byDate.get(s.date).has(String(s.code)))byDate.get(s.date).set(String(s.code),{code:String(s.code),name:String(s.name??s.code),close:Number(s.close)});
 }
 const events=[],missing=[];
 for(let i=1;i<dates.length;i++){
  const date=dates[i],previousDate=dates[i-1],current=byDate.get(date),previous=byDate.get(previousDate);
  const marketReturn=pct(marketByDate.get(previousDate),marketByDate.get(date));
  if(marketReturn>-2)continue;
  if(!current||!previous||current.size<minimumCoverage||previous.size<minimumCoverage){
   missing.push({date,reason:"INSUFFICIENT_COVERAGE"});continue;
  }
  const selected=[];
  for(const [code,stock] of current){
   const prev=previous.get(code);if(!prev)continue;
   const dailyReturn=pct(prev.close,stock.close),excess=dailyReturn-marketReturn;
   if(dailyReturn<=0&&excess<3)continue;
   const returns={};
   for(const horizon of HORIZONS){
    const futureDate=dates[i+horizon],future=futureDate?byDate.get(futureDate)?.get(code):null;
    const benchmark=futureDate?marketByDate.get(futureDate):null;
    returns[horizon]=future&&finitePositive(benchmark)?{
     date:futureDate,stockReturn:pct(stock.close,future.close),
     marketReturn:pct(marketByDate.get(date),benchmark),
     excessReturn:pct(stock.close,future.close)-pct(marketByDate.get(date),benchmark)
    }:null;
   }
   selected.push({code,name:stock.name,date,close:stock.close,dailyReturn,excess,group:dailyReturn>0?"REVERSE_GAIN":"RELATIVE_RESILIENCE",returns});
  }
  selected.sort((a,b)=>b.excess-a.excess||a.code.localeCompare(b.code));
  events.push({date,previousDate,marketReturn,coverage:current.size,candidates:selected});
 }
 const summaries={};
 for(const horizon of HORIZONS){
  const records=events.flatMap(e=>e.candidates.map(c=>({date:e.date,code:c.code,result:c.returns[horizon]})));
  const observed=records.filter(r=>r.result!==null),values=observed.map(r=>r.result.stockReturn);
  summaries[horizon]={candidateCount:records.length,observedCount:observed.length,missingCount:records.length-observed.length,
   eventCount:new Set(observed.map(r=>r.date)).size,average:values.length?mean(values):null,
   median:values.length?median(values):null,positiveRate:values.length?100*values.filter(v=>v>0).length/values.length:null,
   averageExcess:values.length?mean(observed.map(r=>r.result.excessReturn)):null};
 }
 return {version:"CRASH_RESILIENCE_V2_OFFLINE",asOf,benchmark:"TOPIX",events,missing,summaries,
  disclaimer:"Retrospective daily-close references only. No intraday fill, fees, slippage, live forward evidence, or trading recommendation."};
}
/** Compare independently captured next-session reference prices; do not infer a fill from a 5m candle. */
export function compareEntrySlots({signalDate,code,slots,exitClose}){
 if(!dateOk(signalDate)||!/^\d{4}$/.test(String(code)))throw Error("INVALID_ENTRY_TARGET");
 const expected=["09:20","11:20","14:15"];
 return expected.map(slot=>{
  const row=slots.find(x=>x.slot===slot);
  const valid=row&&dateOk(row.tradeDate)&&row.tradeDate>signalDate&&finitePositive(row.price)&&row.sourceTimestamp&&row.capturedAt;
  return {slot,status:valid?"REFERENCE_ONLY":"MISSING_VERIFIED_REFERENCE",
   entryPrice:valid?Number(row.price):null,
   returnToExit:valid&&finitePositive(exitClose)?pct(Number(row.price),Number(exitClose)):null};
 });
}
