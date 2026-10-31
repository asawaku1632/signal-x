/**
 * SHADOW ONLY: safely normalize ALREADY SAVED display_snapshots chart rows.
 * No DB queries, provider APIs, scheduling, notifications or trading.
 * Normalizing Yahoo data does NOT certify its licence, original as-of time or
 * suitability for a current trading decision.
 */
export const MA75_CHART_SNAPSHOT_ADAPTER_VERSION='ma75_chart_snapshot_adapter_v1';
const codePattern=/^[0-9]{3}[0-9A-Z]$/;
const positiveFinite=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const epoch=x=>Number.isSafeInteger(x)&&x>=946684800&&x<4102444800;
const iso=x=>{
  if(typeof x!=='string')return null;
  let value=x.trim();
  // Postgres timestamptz displays +00, JavaScript requires +00:00.
  if(/[+-]\d{2}$/.test(value))value+=':00';
  value=value.replace(' ','T');
  if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const t=Date.parse(value);
  return Number.isFinite(t)?new Date(t).toISOString():null;
};
export function normalizeMa75SavedChartSnapshots(rows){
 if(!Array.isArray(rows))throw new TypeError('Expected only read-only saved chart rows');
 const snapshots=[],rejected=[],ids=new Set();
 for(let i=0;i<rows.length;i++){
   const row=rows[i];
   const key=row?.snapshot_key;
   const match=typeof key==='string'?/^chart:([0-9]{3}[0-9A-Z]):1D$/.exec(key):null;
   const code=match?.[1]??null;
   const payload=row?.payload;
   let reason=null;
   if(!codePattern.test(code??''))reason='INVALID_SNAPSHOT_KEY';
   else if(ids.has(code))reason='DUPLICATE_SAVED_CODE';
   else if(!payload||typeof payload!=='object'||Array.isArray(payload))
     reason='INVALID_PAYLOAD';
   else if(payload.symbol!==code+'.T'||payload.timeframe!=='1D'||
      payload.dataSource!=='yahoo_chart')
     reason='SOURCE_OR_SYMBOL_MISMATCH';
   else if(!Array.isArray(payload.candles)||payload.candles.length<1||
      !Number.isInteger(row.item_count)||row.item_count!==payload.candles.length||
      !Number.isInteger(payload.count)||payload.count!==payload.candles.length)
     reason='BAR_COUNT_MISMATCH';
   const saved=iso(row?.updated_at);
   if(!reason && !saved)reason='INVALID_SAVED_TIMESTAMP';
   if(!reason && payload.candles.some((b,j,a)=>
      !b||!epoch(b.time)||!positiveFinite(b.open)||!positiveFinite(b.high)||
      !positiveFinite(b.low)||!positiveFinite(b.close)||
      typeof b.volume!=='number'||!Number.isFinite(b.volume)||b.volume<0||
      b.high<Math.max(b.open,b.close,b.low)||
      b.low>Math.min(b.open,b.close,b.high)||
      (j>0 && b.time<=a[j-1].time)))
     reason='INVALID_SAVED_OHLCV';
   if(!reason && payload.candles.at(-1).time*1000>Date.parse(saved))
     reason='BAR_AFTER_SNAPSHOT_SAVE';
   if(reason){rejected.push({key:String(key??'?'),reason});continue;}
   ids.add(code);
   snapshots.push({code,provider:'yahoo_chart',timeframe:'1D',
     updatedAt:saved,candles:payload.candles.map(b=>({
       time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,
     }))});
 }
 return {version:MA75_CHART_SNAPSHOT_ADAPTER_VERSION,
   scannedRows:rows.length,accepted:snapshots.length,rejectedCount:rejected.length,
   snapshots,rejected,providerRightsVerified:false,eligibleForProduction:false,
   note:'Source is an already-saved chart payload; reuse only under approved source terms and historical-only research policy.'};
}
