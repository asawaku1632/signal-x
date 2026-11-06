/** Read-only diagnostic for frozen morning decisions.
 * A PARTIAL run with all UNAVAILABLE cannot prove a 09:05 signal's edge.
 * The diagnostic never reconstructs absent 5m candles or claims a win.
 */
export const MORNING_CAPTURE_HEALTH_VERSION="FROZEN_MORNING_COVERAGE_AUDIT_V1";
const missingOpeningReasons=new Set(["MISSING_CANDLES","MISSING_0900_BAR",
  "MISSING_0905_BAR","MISSING_BOTH_OPENING_SLOTS"]);
export function summarizeMorningCaptureHealth(rows){
  const seen=new Set(),reasons=new Map();
  let days=0,slots=0,available=0,missing=0,unavailable=0;
  for(const run of Array.isArray(rows)?rows:[]){
    const date=String(run?.trade_date??"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||seen.has(date))continue;
    seen.add(date);days++;
    for(const item of Array.isArray(run?.morning_observations)?run.morning_observations:[]){
      const code=String(item?.code??"");
      if(!/^[0-9A-Z]{4}$/.test(code))continue;
      slots++;
      if(["BUY_CANDIDATE","CAUTION","SKIP"].includes(item?.label)){
        available++;continue;
      }
      unavailable++;
      const reason=String(item?.quoteReason??"UNSPECIFIED");
      reasons.set(reason,(reasons.get(reason)??0)+1);
      if(missingOpeningReasons.has(reason))missing++;
    }
  }
  return {policy:MORNING_CAPTURE_HEALTH_VERSION,days,slots,available,unavailable,missing,
    availablePct:slots?Number((100*available/slots).toFixed(2)):null,
    reasons:[...reasons].map(([reason,count])=>({reason,count}))
      .sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason)),
    status:slots===0?"NO_CAPTURE_DATA":available===0?"NO_USABLE_MORNING_DECISIONS":
      available<slots?"PARTIAL_MORNING_COVERAGE":"COMPLETE_MORNING_COVERAGE"};
}
