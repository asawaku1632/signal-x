// Human-review evidence gates; pure, read-only and never an approval decision.
export type ResearchProof={researchId:string;sourceProvider:string|null;licenseReference:string|null;independentSignalAt:string|null;barEndAt:string|null;observedAt:string|null;forwardOutcomeDate:string|null;forwardReturn:number|null;outcomeProvider:string|null;calendarVerified:boolean;holdoutVerified:boolean;marketRegimeVerified:boolean;sampleOnly:boolean};
const iso=(s:string|null)=>s!==null&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s)&&Number.isFinite(Date.parse(s));
export function evaluateResearchProof(p:ResearchProof){
 const missing:string[]=[];
 if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.researchId))missing.push("INVALID_RESEARCH_ID");
 if(!p.sourceProvider?.trim())missing.push("SOURCE_PROVIDER_MISSING");
 if(!p.licenseReference?.trim())missing.push("LICENSE_REFERENCE_MISSING");
 if(!iso(p.independentSignalAt))missing.push("SIGNAL_TIME_UNVERIFIED");
 if(!iso(p.barEndAt))missing.push("BAR_END_UNVERIFIED");
 if(!iso(p.observedAt))missing.push("OBSERVATION_TIME_UNVERIFIED");
 if(iso(p.independentSignalAt)&&iso(p.barEndAt)&&Date.parse(p.independentSignalAt!)<=Date.parse(p.barEndAt!))missing.push("SIGNAL_NOT_INDEPENDENT");
 if(iso(p.observedAt)&&iso(p.independentSignalAt)&&Date.parse(p.observedAt!)<Date.parse(p.independentSignalAt!))missing.push("OBSERVED_BEFORE_SIGNAL");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.forwardOutcomeDate??""))missing.push("FORWARD_DATE_MISSING");
 if(p.forwardReturn===null||!Number.isFinite(p.forwardReturn))missing.push("FORWARD_RETURN_MISSING");
 if(!p.outcomeProvider?.trim())missing.push("OUTCOME_PROVIDER_MISSING");
 if(!p.calendarVerified)missing.push("CALENDAR_UNVERIFIED");
 if(!p.holdoutVerified)missing.push("HOLDOUT_UNVERIFIED");
 if(!p.marketRegimeVerified)missing.push("REGIME_UNVERIFIED");
 if(p.sampleOnly)missing.push("SAMPLE_ONLY");
 return {reviewReady:missing.length===0,missing,adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
export function summarizeResearchProofs(proofs:ResearchProof[]){
 if(proofs.length>1000)throw Error("PROOF_SUMMARY_LIMIT");
 const entries=proofs.map(evaluateResearchProof);
 const reasons:Record<string,number>={};
 for(const result of entries)for(const issue of result.missing)reasons[issue]=(reasons[issue]??0)+1;
 return {total:entries.length,reviewReady:entries.filter(x=>x.reviewReady).length,blocked:entries.filter(x=>!x.reviewReady).length,reasons,adoptionApproved:false as const,productionApplied:false as const};
}
