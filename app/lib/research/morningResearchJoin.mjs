/** Read-only, offline as-of join. Inputs are independently exported; no provider fetch or writes.
 * A structural match is not proof of data rights, independence or forecasting quality.
 */
import {prepareMorningForwardRows,auditVerifiedMorningExports} from "./morningVerifiedForward.mjs";
const code=/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/;
const date=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export function joinMorningResearchExports(features,bars,{independentProvenance=false}={}){
  if(!Array.isArray(features)||!Array.isArray(bars)||features.length>100000||bars.length>100000)
    throw Error("INVALID_MORNING_JOIN_INPUT");
  const byKey=new Map(),featureCounts=new Map(),barCounts=new Map();
  for(const f of features){
    if(!code.test(f?.code??"")||!date.test(f?.tradeDate??""))continue;
    const key=f.code+"|"+f.tradeDate;
    featureCounts.set(key,(featureCounts.get(key)??0)+1);
    if(!byKey.has(key))byKey.set(key,f);
  }
  for(const b of bars){
    if(!code.test(b?.code??"")||!date.test(b?.tradeDate??""))continue;
    const key=b.code+"|"+b.tradeDate;
    barCounts.set(key,(barCounts.get(key)??0)+1);
  }
  const candidates=[];
  let unmatchedBars=0,duplicateKeys=0;
  for(const b of bars){
    const key=b?.code+"|"+b?.tradeDate;
    const f=byKey.get(key);
    if(!f){unmatchedBars++;continue;}
    if(featureCounts.get(key)!==1||barCounts.get(key)!==1){duplicateKeys++;continue;}
    candidates.push({...b,features:f.features,featureAvailableAt:f.featureAvailableAt});
  }
  const prepared=prepareMorningForwardRows(candidates);
  const audit=auditVerifiedMorningExports(candidates);
  return {
    version:"MORNING_RESEARCH_ASOF_JOIN_V1",
    featureInputCount:features.length,barInputCount:bars.length,
    candidates:candidates.length,accepted:prepared.rows.length,
    unmatchedBars,duplicateKeys,excluded:prepared.excluded,
    // Independently verified provenance must be evidenced externally.
    independentProvenanceConfirmed:independentProvenance===true,
    results:independentProvenance===true?audit:null,
    bottomTimeDistribution:independentProvenance===true?audit.audit?.bottomTimeCounts??null:null,
    signalEnabled:false,readyForTrading:false,
    note:"Caller provenance flag is not authenticated by this module. Do not publish measured rates without an independent rights and bar-integrity audit."
  };
}
