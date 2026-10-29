/** Offline verification of a separately retained checkpoint. No network I/O.
 * Whoever controls BOTH ledger and checkpoint can rewrite both.
 */
import {inspectLocalSnapshotLedger} from "./localSnapshotLedger.mjs";
const hex=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
export function makeLedgerCheckpoint(records,observedAt){
 const audit=inspectLocalSnapshotLedger(records);
 if(!audit.valid)throw Error("INVALID_LEDGER_FOR_CHECKPOINT");
 if(typeof observedAt!=="string"||!/^(?:\d{4})-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(observedAt)||!Number.isFinite(Date.parse(observedAt)))throw Error("INVALID_CHECKPOINT_TIMESTAMP");
 return {schema:"LEDGER_CHECKPOINT_V1",recordCount:records.length,head:audit.head,observedAt,
   externallyWitnessed:false};
}
export function verifyLedgerCheckpoint(records,checkpoint){
 if(!Array.isArray(records)||!checkpoint||checkpoint.schema!=="LEDGER_CHECKPOINT_V1"||
 !Number.isSafeInteger(checkpoint.recordCount)||checkpoint.recordCount<0||!hex(checkpoint.head))
 return {valid:false,reason:"INVALID_CHECKPOINT",externallyAuthenticated:false};
 const a=inspectLocalSnapshotLedger(records);
 if(!a.valid)return {valid:false,reason:"LEDGER_CORRUPT",externallyAuthenticated:false};
 if(records.length<checkpoint.recordCount)return {valid:false,reason:"TRUNCATED",externallyAuthenticated:false};
 const prefix=inspectLocalSnapshotLedger(records.slice(0,checkpoint.recordCount));
 const ok=prefix.valid&&prefix.head===checkpoint.head;
 return {valid:ok,reason:ok?"CHECKPOINT_MATCH":"CHECKPOINT_MISMATCH",externallyAuthenticated:false,
   checkedPrefix:checkpoint.recordCount};
}
