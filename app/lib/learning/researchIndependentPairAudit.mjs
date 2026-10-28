import { auditStoredObservation } from "./researchObservationProvenanceGate.mjs";
// Research-only: independent comparison inputs remain untrusted until externally attested.
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+"T00:00:00Z")) && new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const stamp = (v) => typeof v === "string" && Number.isFinite(Date.parse(v)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(v);
const key = (r) => r.trade_date+"|"+r.code;
export function inspectEvidencePair(observation, baseline, shadow, regime){
  const issues = [...auditStoredObservation(observation).issues];
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) issues.push("MISSING_BASELINE");
  if (!shadow || typeof shadow !== "object" || Array.isArray(shadow)) issues.push("MISSING_SHADOW");
  if (!regime || typeof regime !== "object" || Array.isArray(regime)) issues.push("MISSING_REGIME");
  const rows=[["BASELINE",baseline],["SHADOW",shadow],["REGIME",regime]];
  for(const [prefix,r] of rows) {
    if (!r || typeof r!=="object" || Array.isArray(r)) continue;
    if(!observation || r.trade_date!==observation.trade_date || r.code!==observation.code) issues.push(prefix+"_KEY_MISMATCH");
    if(!isDate(r.trade_date)) issues.push(prefix+"_INVALID_DATE");
    if(!stamp(r.recorded_at)) issues.push(prefix+"_INVALID_RECORDED_AT");
    if(stamp(r.recorded_at)&&stamp(observation?.captured_at)&&Date.parse(r.recorded_at)>Date.parse(observation.captured_at)) issues.push(prefix+"_RECORDED_AFTER_CAPTURE");
    if(r.provider_verified!==true) issues.push(prefix+"_PROVIDER_UNVERIFIED");
    if(r.license_verified!==true) issues.push(prefix+"_LICENSE_UNVERIFIED");
    if(typeof r.source_digest!=="string"||r.source_digest.length===0) issues.push(prefix+"_MISSING_DIGEST");
  }
  if(baseline&&shadow&&typeof baseline==="object"&&typeof shadow==="object") {
    if(!num(baseline.return_5d)||!num(shadow.return_5d)) issues.push("PAIR_INVALID_RETURN");
    if(!isDate(baseline.outcome_5d_date)||baseline.outcome_5d_date!==shadow.outcome_5d_date || baseline.outcome_5d_date!==observation?.outcome_5d_date) issues.push("PAIR_OUTCOME_DATE_MISMATCH");
    if(baseline.rule_version===shadow.rule_version) issues.push("PAIR_NOT_INDEPENDENT_VARIANT");
    if(baseline.source_digest===shadow.source_digest && baseline.source_digest) issues.push("PAIR_SHARED_SOURCE_REQUIRES_REVIEW");
  }
  if(regime && typeof regime==="object") {
    if(!["UP","DOWN","SIDEWAYS"].includes(regime.market_regime)) issues.push("UNVERIFIED_REGIME_LABEL");
    if(!stamp(regime.classified_at)||!stamp(observation?.captured_at)||Date.parse(regime.classified_at)>Date.parse(observation.captured_at)) issues.push("REGIME_LOOKAHEAD");
  }
  return {status:"BLOCKED",issues:[...new Set(issues)]};
}
export function inspectEvidencePairs(observations, baselines, shadows, regimes, limit=1000) {
  if(![observations,baselines,shadows,regimes].every(Array.isArray)) return {status:"BLOCKED",checked:0,truncated:false,reasons:{INVALID_COLLECTION:1}};
  const bound=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):1000;
  const reasons={}, distinct=new Set();
  function index(rows,kind){
    const m=new Map();
    for(const row of rows.slice(0,bound)){
      if(!row||typeof row!=="object"||typeof row.trade_date!=="string"||typeof row.code!=="string"){reasons[kind+"_INVALID_ROW"]=(reasons[kind+"_INVALID_ROW"]||0)+1;continue}
      const k=key(row);
      if(m.has(k)) {reasons[kind+"_DUPLICATE"]=(reasons[kind+"_DUPLICATE"]||0)+1;continue}
      m.set(k,row);
    }
    return m;
  }
  const bm=index(baselines,"BASELINE"),sm=index(shadows,"SHADOW"),rm=index(regimes,"REGIME");
  const observed=new Set();
  for(const o of observations.slice(0,bound)){
    const k=o&&typeof o==="object"?key(o):"INVALID";
    if(observed.has(k)) reasons.DUPLICATE_OBSERVATION=(reasons.DUPLICATE_OBSERVATION||0)+1;
    observed.add(k);
    if(k!=="INVALID") distinct.add(k);
    const result=inspectEvidencePair(o,bm.get(k),sm.get(k),rm.get(k));
    for(const issue of result.issues) reasons[issue]=(reasons[issue]||0)+1;
  }
  for(const [name,m] of [["BASELINE",bm],["SHADOW",sm],["REGIME",rm]]) for(const k of m.keys()) if(!distinct.has(k)) reasons[name+"_ORPHAN"]=(reasons[name+"_ORPHAN"]||0)+1;
  const truncated=[observations,baselines,shadows,regimes].some(v=>v.length>bound);
  if(truncated) reasons.TRUNCATED_INPUT=1;
  return {status:"BLOCKED",checked:Math.min(observations.length,bound),truncated,reasons};
}
