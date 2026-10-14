/** Shadow-only fixed cohort: frozen prior-session top five and cached market-wide scan.
 * No new Yahoo fetches, no recomputation of AI, no score/notification mutation.
 * Missing and delayed underlying quote bars are omitted, never backfilled.
 */
import { selectPriorDayCandidates } from "./entryTimeShadow.mjs";

export const FIXED_STABILITY_VERSION="PRIOR_DAY_TOP5_CACHED_SCAN_V1";
export const FIXED_STABILITY_MAX_BAR_AGE_MS=25*60*1000;
const DATE_RX=/^\d{4}-\d{2}-\d{2}$/;
function positive(v) {
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);return Number.isFinite(n)&&n>0?n:null;
}
function validPower(v){
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?n:null;
}
function jstDate(milliseconds){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(milliseconds));
}
/** The same frozen cohort is used by EVERY session's observation slot.
 * Rows must be available from yesterday's saved learning results.
 * Comparing times does not select post-hoc strongest movers.
 */
export function collectFixedStabilityObservations({cohort,stocks,tradeDate,priorDate,
  timeSlot,snapshotSavedAt,now}){
  if(!DATE_RX.test(tradeDate)||!DATE_RX.test(priorDate)||
    typeof timeSlot!=="string"||!Array.isArray(stocks)||
    !Number.isFinite(new Date(now).getTime())||
    !Number.isFinite(new Date(snapshotSavedAt).getTime()))
    throw Error("INVALID_FIXED_COHORT_INPUT");
  const selected=selectPriorDayCandidates(cohort);
  const map=new Map(stocks.map(s=>[String(s?.code??""),s]));
  const valid=[];
  const missing=[];
  for(const c of selected){
    const s=map.get(c.code);
    if(!s){missing.push({code:c.code,reason:"MISSING_STOCK"});continue;}
    const price=positive(s.price??s.currentPrice);
    const score=validPower(s.score??s.aiPower);
    const epoch=Number(s.latestBarTimestamp);
    if(price===null||score===null||!Number.isInteger(epoch)||epoch<1_500_000_000||epoch>2_100_000_000){
      missing.push({code:c.code,reason:"INVALID_OR_MISSING_QUOTE"});continue;
    }
    const when=epoch*1000;
    const age=new Date(now).getTime()-when;
    if(age < -120_000 || age>FIXED_STABILITY_MAX_BAR_AGE_MS || jstDate(when)!==tradeDate){
      missing.push({code:c.code,reason:"STALE_OR_WRONG_DAY_BAR"});continue;
    }
    valid.push({
      tradeDate,priorDate,timeSlot,code:c.code,name:c.name,
      priorScore:c.score,priorRank:c.rank,
      score,price,quoteTimestamp:new Date(when).toISOString(),
      snapshotSavedAt:new Date(snapshotSavedAt).toISOString(),
    });
  }
  return {expected:selected.length,valid,missing};
}
