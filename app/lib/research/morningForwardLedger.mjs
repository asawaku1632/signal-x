/** Offline-only reconciliation for prospective 09:05 study records. No DB/API or trading effects. */
const day=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const stamp=s=>{
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))return false;
 const y=Number(s.slice(0,4)),m=Number(s.slice(5,7)),d=Number(s.slice(8,10));
 const hour=Number(s.slice(11,13)),minute=Number(s.slice(14,16)),second=Number(s.slice(17,19));
 const offset=s.match(/([+-])(\d{2}):(\d{2})$/);
 return y>=100&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate()&&
  hour<=23&&minute<=59&&second<=59&&(!offset||(Number(offset[2])<=23&&Number(offset[3])<=59));
};
export function reconcileMorningForwardLedger({snapshots=[],outcomes=[]}={}){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes))throw Error("INVALID_LEDGER_INPUT");
 const key=x=>JSON.stringify([x.experimentId,x.tradeDate,x.code]);
 const snapshotsByKey=new Map(),outcomesByKey=new Map();
 for(const s of snapshots){if(!s||!day(s.tradeDate)||typeof s.code!=="string"||!s.code||typeof s.experimentId!=="string"||!s.experimentId)continue;
  const k=key(s),list=snapshotsByKey.get(k)??[];list.push(s);snapshotsByKey.set(k,list);}
 for(const o of outcomes){if(!o||!day(o.tradeDate)||typeof o.code!=="string"||!o.code||typeof o.experimentId!=="string"||!o.experimentId)continue;
  const k=key(o),list=outcomesByKey.get(k)??[];list.push(o);outcomesByKey.set(k,list);}
 const reasons={duplicateSnapshot:0,duplicateOutcome:0,missingOutcome:0,invalidPredecision:0,invalidOutcome:0,missingRights:0};
 const paired=[];
 for(const [k,ss] of snapshotsByKey){
  if(ss.length!==1){reasons.duplicateSnapshot++;continue;}
  const s=ss[0],os=outcomesByKey.get(k)??[];
  if(os.length>1){reasons.duplicateOutcome++;continue;}
  if(!os.length){reasons.missingOutcome++;continue;}
  const cutoff=Date.parse(s.tradeDate+"T09:05:00+09:00");
  if(!stamp(s.recordedAt)||Date.parse(s.recordedAt)>=cutoff||Date.parse(s.recordedAt)<Date.parse(s.tradeDate+"T00:00:00+09:00")){reasons.invalidPredecision++;continue;}
  if(s.sourceVerified!==true||s.researchUseAllowed!==true){reasons.missingRights++;continue;}
  const o=os[0];
  if(!stamp(o.outcomeAvailableAt)||Date.parse(o.outcomeAvailableAt)<=cutoff||o.outcomeSourceVerified!==true||
     !Number.isFinite(o.baselineReturn)||!Number.isFinite(o.candidateReturn)){reasons.invalidOutcome++;continue;}
  paired.push({experimentId:s.experimentId,tradeDate:s.tradeDate,code:s.code,
   recordedAt:s.recordedAt,outcomeAvailableAt:o.outcomeAvailableAt,
   baselineReturn:o.baselineReturn,candidateReturn:o.candidateReturn});
 }
 return {version:"MORNING_FORWARD_LEDGER_OFFLINE_V1",snapshotCount:snapshots.length,
  outcomeCount:outcomes.length,paired,pairedCount:paired.length,reasons,
  independentlyAuthenticated:false,readyForTraining:false,readyForTrading:false,
  readyForNotifications:false,decision:"DO_NOT_PROMOTE"};
}
