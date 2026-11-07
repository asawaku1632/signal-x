import {jquantsCode} from "./jquantsNightData.mjs";
export const BUY_FAMILIES=[
 ["HIGH_BREAKOUT","高値突破"],["PULLBACK_REBOUND","押し目反発"],["BB_UP_EXPANSION","BB上方向拡大"],
 ["TRIANGLE","三角持ち合い"],["STRUCTURE_pattern019","ボックス上抜け"],["STRUCTURE_pattern016","上昇フラッグ"],
 ["STRUCTURE_pattern017","上昇ペナント"],["STRUCTURE_pattern022","逆三尊"]
];
export function buyFamily(kind){return kind==="STRUCTURE_pattern031"||kind==="STRUCTURE_pattern033"?"TRIANGLE":BUY_FAMILIES.some(x=>x[0]===kind)?kind:null;}
const dayOf=ms=>new Date(ms+32400000).toISOString().slice(0,10);
export function evaluateBuyOutcome(event,plan,rows,nowMs){
 const required=plan.required_dates;
 if(![1,3,5].includes(plan.horizon)||!Array.isArray(required)||required.length!==plan.horizon||
  required.at(-1)!==plan.target_date||required.some((d,i)=>typeof d!=="string"||d<=event.trade_date||(i>0&&d<=required[i-1])))
  return {status:"INVALID_EVENT",note:"INVALID_TARGET_PLAN"};
 const matureAt=Date.parse(plan.target_date+"T16:30:00+09:00");
 if(!Number.isFinite(matureAt))return {status:"INVALID_EVENT",note:"INVALID_TARGET_DATE"};
 if(nowMs<matureAt)return {status:"PENDING",note:"NOT_MATURE"};
 const price=event.reference_price,bar=event.bar_time*1000,detected=Date.parse(event.detected_at);
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(bar)||bar<=0||!Number.isFinite(detected)||bar+300000>detected||
  dayOf(bar)!==event.trade_date||dayOf(detected)!==event.trade_date)
  return {status:"INVALID_EVENT",note:"INVALID_FROZEN_EVENT"};
 const selected=rows.filter(r=>r&&jquantsCode(r.Code)===event.code&&required.includes(r.Date));
 const byDate=new Map();
 for(const row of selected){if(byDate.has(row.Date))return {status:"DATA_MISSING",note:"DUPLICATE_PROVIDER_ROWS"};byDate.set(row.Date,row);}
 if(required.some(d=>!byDate.has(d)))return {status:"DATA_MISSING",note:"MISSING_REQUIRED_DATE"};
 const ordered=required.map(d=>byDate.get(d));
 if(ordered.some(r=>typeof r.AdjFactor!=="number"||!Number.isFinite(r.AdjFactor)||r.AdjFactor<=0))
  return {status:"DATA_MISSING",note:"MISSING_ADJUSTMENT_FACTOR"};
 const evidence={provider:"JQUANTS_V2_DAILY_UNADJUSTED",observedAt:new Date(nowMs).toISOString(),
  rows:ordered.map(r=>({Date:r.Date,Code:r.Code,O:r.O,H:r.H,L:r.L,C:r.C,Vo:r.Vo,AdjFactor:r.AdjFactor}))};
 if(ordered.some(r=>r.AdjFactor!==1))return {status:"CORPORATE_ACTION_REVIEW",note:"SPLIT_OR_OTHER_ADJUSTMENT",evidence};
 const r=ordered.at(-1);
 if(![r.O,r.H,r.L,r.C,r.Vo].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>0)||r.H<Math.max(r.O,r.C,r.L)||r.L>Math.min(r.O,r.C))
  return {status:"DATA_MISSING",note:"TARGET_NO_TRADE_OR_INVALID_OHLCV"};
 return {status:"COMPLETE",close_price:r.C,return_pct:(r.C/price-1)*100,note:"REFERENCE_PRICE_TO_FUTURE_CLOSE",evidence};
}
