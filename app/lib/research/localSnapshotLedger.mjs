/** Explicit local-only append ledger. No production DB, network or alerts.
 * Hash chain detects accidental edits against a separately retained head.
 * It is NOT a trusted timestamp, WORM storage, or external attestation.
 */
import {createHash} from "node:crypto";
import {openSync,closeSync,writeSync,readFileSync,fsyncSync} from "node:fs";
import {inspectDetachedSnapshot} from "./detachedSnapshotContract.mjs";
const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const genesis="0".repeat(64);
const key=s=>s.date+"|"+s.code;
export function inspectLocalSnapshotLedger(records){
 if(!Array.isArray(records))throw Error("INVALID_LEDGER_RECORDS");
 let head=genesis;const seen=new Set();
 for(let i=0;i<records.length;i++){
  const item=records[i],s=item?.snapshot;
  if(!inspectDetachedSnapshot(s).structurallyIntact||seen.has(key(s))||
     item.index!==i||item.previousDigest!==head||
     item.recordDigest!==digest({index:i,previousDigest:head,snapshot:s}))
   return {valid:false,failedIndex:i,head,recordsChecked:i};
  seen.add(key(s));head=item.recordDigest;
 }
 return {valid:true,head,recordsChecked:records.length};
}
export function planLocalSnapshotAppend(existing,snapshot){
 const audit=inspectLocalSnapshotLedger(existing);
 if(!audit.valid)throw Error("CORRUPT_LOCAL_LEDGER");
 if(!inspectDetachedSnapshot(snapshot).structurallyIntact)throw Error("INVALID_SNAPSHOT");
 if(existing.some(r=>key(r.snapshot)===key(snapshot)))throw Error("DUPLICATE_SNAPSHOT_KEY");
 const record={index:existing.length,previousDigest:audit.head,snapshot};
 return {...record,recordDigest:digest(record)};
}
export function readLocalSnapshotLedger(file){
 let raw;
 try{raw=readFileSync(file,"utf8");}catch(e){if(e.code==="ENOENT")return [];throw e;}
 if(raw.length>25*1024*1024)throw Error("LEDGER_TOO_LARGE");
 const lines=raw.trim()?raw.trimEnd().split("\n"):[];
 const records=lines.map(x=>JSON.parse(x));
 if(!inspectLocalSnapshotLedger(records).valid)throw Error("CORRUPT_LOCAL_LEDGER");
 return records;
}
export function appendLocalSnapshot(file,snapshot){
 // Existing files must be valid. Exclusive create on first write, append only.
 const current=readLocalSnapshotLedger(file);
 const entry=planLocalSnapshotAppend(current,snapshot);
 const fd=openSync(file,current.length?"a":"ax",0o600);
 try{writeSync(fd,JSON.stringify(entry)+"\n");fsyncSync(fd);}finally{closeSync(fd);}
 return {index:entry.index,head:entry.recordDigest,localOnly:true};
}
