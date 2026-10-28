// Research-only adapter for the actual swing_universe_observations schema.
// Recorded outcomes are descriptive only. Never assume licensed or independently attested provenance.
const validDate = s => typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z")) && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const numeric = x => typeof x==="number" && Number.isFinite(x);
export function inspectActualStoredObservation(row) {
 const reasons=[];
 if(!row || typeof row!=="object" || Array.isArray(row)) return {status:"BLOCKED",reasons:["INVALID_ROW"]};
 if(!validDate(row.trade_date))reasons.push("INVALID_TRADE_DATE");
 if(typeof row.code!=="string"||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(row.code))reasons.push("INVALID_CODE");
 if(!numeric(row.entry_price)||row.entry_price<=0)reasons.push("INVALID_ENTRY");
 if(!numeric(row.ai_power)||row.ai_power<0||row.ai_power>100)reasons.push("INVALID_AI_POWER");
 if(typeof row.captured_at!=="string"||!Number.isFinite(Date.parse(row.captured_at))||!/(?:Z|[+-]\d{2}:\d{2})$/.test(row.captured_at))reasons.push("INVALID_CAPTURE_TIME");
 if(row.return_5d==null)reasons.push("PENDING_FIVE_DAY_OUTCOME");
 else if(!numeric(row.return_5d))reasons.push("INVALID_FIVE_DAY_OUTCOME");
 if(row.outcome_5d_date==null){if(row.return_5d!=null)reasons.push("MISSING_FIVE_DAY_DATE")}
 else if(!validDate(row.outcome_5d_date)||validDate(row.trade_date)&&row.outcome_5d_date<=row.trade_date)reasons.push("INVALID_FIVE_DAY_DATE");
 if(!row.rule_version || typeof row.rule_version!=="string") reasons.push("MISSING_RULE_VERSION");
 // These fields are not in the observed production schema: never infer them.
 reasons.push("INDEPENDENT_PROVIDER_LICENSE_PROOF_ABSENT","SIGNAL_BAR_PROVENANCE_ABSENT","BASELINE_SHADOW_PAIR_ABSENT","MARKET_REGIME_PROVENANCE_ABSENT","OUT_OF_SAMPLE_REPLICATION_NOT_ATTESTED");
 return {status:"BLOCKED",reasons:[...new Set(reasons)],observationKey:validDate(row.trade_date)&&typeof row.code==="string"?row.trade_date+"|"+row.code:null,hasFiveDayOutcome:numeric(row.return_5d)&&validDate(row.outcome_5d_date)&&row.outcome_5d_date>row.trade_date};
}
export function summarizeActualStoredObservations(rows,{limit=1000}={}){
 if(!Array.isArray(rows))return {status:"BLOCKED",checked:0,truncated:false,reasonCounts:{INVALID_BATCH:1}};
 const max=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):1000;
 const reasons={},seen=new Set(),days=new Set(),stocks=new Set();
 let complete=0;
 for(const row of rows.slice(0,max)){
  const item=inspectActualStoredObservation(row);
  for(const code of item.reasons)reasons[code]=(reasons[code]||0)+1;
  if(item.observationKey){if(seen.has(item.observationKey))reasons.DUPLICATE_OBSERVATION=(reasons.DUPLICATE_OBSERVATION||0)+1;seen.add(item.observationKey);days.add(row.trade_date);stocks.add(row.code)}
  if(item.hasFiveDayOutcome)complete++;
 }
 const truncated=rows.length>max;
 if(truncated)reasons.TRUNCATED_READ=1;
 return {status:"BLOCKED",checked:Math.min(rows.length,max),truncated,completedFiveDay:complete,distinctDays:days.size,distinctStocks:stocks.size,reasonCounts:reasons,productionEligible:false};
}
