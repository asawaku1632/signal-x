// Research-only strict adapter for manually supplied J-Quants rows.
// This module does NOT call provider APIs, persist data, or modify the existing endpoint.
import {buildDualSurgeLedger,summarizeLedger} from "./dualSurgeLedger.mjs";
export function normalizeResearchRows(providerRows,code){
 if(!Array.isArray(providerRows)||typeof code!=="string"||!/^[0-9]{4}$/.test(code))throw Error("INVALID_INPUT");
 const rows=[];
 for(const raw of providerRows){
  if(!raw||typeof raw.Code!=="string"||!(raw.Code===code||raw.Code===code+"0")||typeof raw.Date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw.Date)||!Number.isFinite(Date.parse(raw.Date+"T00:00:00Z")))throw Error("INVALID_PROVIDER_ROW");
  const {O,H,L,C,Vo,AdjFactor}=raw;
  if(![O,H,L,C].every(x=>typeof x==="number"&&Number.isFinite(x)&&x>0)||typeof Vo!=="number"||!Number.isFinite(Vo)||Vo<0||H<Math.max(O,C,L)||L>Math.min(O,C))throw Error("INVALID_PROVIDER_OHLCV");
  if(typeof AdjFactor!=="number"||!Number.isFinite(AdjFactor)||AdjFactor<=0)throw Error("UNKNOWN_ADJUSTMENT_FACTOR");
  rows.push({date:raw.Date,open:O,close:C,adjFactor:AdjFactor});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.some((r,i)=>i>0&&r.date===rows[i-1].date))throw Error("DUPLICATE_PROVIDER_DATE");
 return rows;
}
export function compareResearchEvents({code,providerRows,signals}){
 const rows=normalizeResearchRows(providerRows,code);
 const ledger=buildDualSurgeLedger({code,rows,signals});
 return {mode:"READ_ONLY_MANUAL_COMPARISON",code,ledger,
  legacyFiveDay:summarizeLedger(ledger,{horizon:5,metric:"legacyCloseToClose"}),
  nextOpenFiveDay:summarizeLedger(ledger,{horizon:5,metric:"nextOpenToFutureClose"}),
  warnings:["Gross price proxies only; no fees, spread, slippage or fill modeling.",
   "No automated provider collection or production integration.",
   "Strict adjustment-factor requirements may exclude historical rows."]};
}
