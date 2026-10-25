// Research-only display gate. Never treats a client-supplied report as independently verified.
import {summarizeReplayResults} from "./dualSurgeRawReplay.mjs";
export function verifiedReplayDisplay({report,evidence}={}){
 const blocked={available:false,reason:"INDEPENDENT_REPLAY_NOT_VERIFIED",summary:null};
 if(!report||!evidence||evidence.licenseVerified!==true||evidence.independentReplayVerified!==true||
    typeof evidence.snapshotId!=="string"||!evidence.snapshotId.trim()||
    typeof evidence.commitSha!=="string"||!/^[a-f0-9]{40}$/.test(evidence.commitSha)||
    report.productionApproved!==false||report.providerRequests!==0||
    report.readOnly!==true||report.allMatched!==true||!Array.isArray(report.results)||
    report.results.length===0||report.eventCount!==report.results.length)return blocked;
 let computed;
 try{computed=summarizeReplayResults(report.results);}catch{return blocked;}
 const s=report.summary;
 if(!s||Object.keys(computed).some(key=>s[key]!==computed[key]))return blocked;
 if(!s||s.total!==report.eventCount||s.unverified!==0||
    s.matched!==s.total||!Number.isInteger(s.pending)||
    !Number.isInteger(s.maturedPositive)||!Number.isInteger(s.maturedNegative)||
    !Number.isInteger(s.maturedFlat)||!Number.isInteger(s.excluded)||
    !Number.isInteger(s.missing)||!Number.isInteger(s.mismatched)||
    [s.pending,s.maturedPositive,s.maturedNegative,s.maturedFlat,s.excluded,s.missing,s.mismatched].some(x=>x<0)||
    s.excluded!==0||s.missing!==0||s.mismatched!==0||
    s.maturedPositive+s.maturedNegative+s.maturedFlat+s.pending!==s.total)return blocked;
 return {available:true,reason:null,summary:{
  total:s.total,positive:s.maturedPositive,negative:s.maturedNegative,
  flat:s.maturedFlat,pending:s.pending
 },snapshotId:evidence.snapshotId,commitSha:evidence.commitSha};
}
