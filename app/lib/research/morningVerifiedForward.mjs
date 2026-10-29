/** Pure, read-only bridge from verified morning observations to forward audit rows.
 * Caller must provide independently sourced prior-day features and publication times.
 * Never infer feature availability or provider licensing from price bars.
 */
import {adaptHistoricalMorning} from "./morningHistoricalAdapter.mjs";
import {auditMorningAnalogsChronologically} from "./morningAnalog.mjs";
const codePattern=/^(?:\d{4}|\d{3}[A-Z])$/;
const validStamp=value=>typeof value==="string" &&
  Number.isFinite(Date.parse(value)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
const featureKeys=["priorReturnPct","priorRangePct","priorVolumeRatio","aiPower"];
export function prepareMorningForwardRows(inputs){
  if(!Array.isArray(inputs)||inputs.length>100000)throw Error("INVALID_MORNING_FORWARD_INPUT");
  const rows=[],excluded={unverifiedBars:0,missingFeatureProof:0,missingOutcomeProof:0,duplicate:0};
  const grouped=new Map();
  for(const input of inputs){
    const outcome=adaptHistoricalMorning(input);
    if(!outcome.valid){excluded.unverifiedBars++;continue;}
    const {code,tradeDate,features,featureAvailableAt,outcomeAvailableAt}=input;
    if(!codePattern.test(code)||!featureKeys.every(k=>Number.isFinite(features?.[k]))||
       !validStamp(featureAvailableAt)||Date.parse(featureAvailableAt)>=Date.parse(tradeDate+"T00:00:00+09:00")){
      excluded.missingFeatureProof++;continue;
    }
    if(!validStamp(outcomeAvailableAt)||
       Date.parse(outcomeAvailableAt)<Date.parse(tradeDate+"T11:30:00+09:00")){
      excluded.missingOutcomeProof++;continue;
    }
    const key=code+"|"+tradeDate;
    const candidate={code,tradeDate,features,featureAvailableAt,outcomeAvailableAt,outcome};
    const group=grouped.get(key)??[];
    group.push(candidate);
    grouped.set(key,group);
  }
  for(const group of grouped.values()){
    if(group.length!==1){excluded.duplicate+=group.length;continue;}
    rows.push(group[0]);
  }
  return {rows,excluded,sourceVerifiedByAdapter:true,signalEnabled:false};
}
export function auditVerifiedMorningExports(inputs,options={}){
  const prepared=prepareMorningForwardRows(inputs);
  const targets=prepared.rows.map(({code,tradeDate,features,featureAvailableAt})=>
    ({code,tradeDate,features,featureAvailableAt}));
  const audit=auditMorningAnalogsChronologically(targets,prepared.rows,
    {...options,requireOutcomeAvailability:true});
  return {version:"VERIFIED_MORNING_EXPORT_AUDIT_V1",
    inputCount:inputs.length,accepted:prepared.rows.length,excluded:prepared.excluded,
    audit,signalEnabled:false,readyForTrading:false,
    note:"Offline replay of supplied exports only; source assertions must be independently verified."};
}
