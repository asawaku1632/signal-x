#!/usr/bin/env node
/** Offline manual research batch. Reads local ledger/outcome JSON; writes stdout only. */
import {readFileSync} from "node:fs";import {resolve} from "node:path";import {pathToFileURL} from "node:url";
import {readLocalSnapshotLedger} from "../app/lib/research/localSnapshotLedger.mjs";
import {auditLocalResearchBatch} from "../app/lib/research/offlineResearchBatch.mjs";
export function reportBatchFromFiles(ledgerPath,outcomesPath,checkpointPath){
 const records=readLocalSnapshotLedger(ledgerPath);
 const raw=readFileSync(outcomesPath,"utf8");
 if(Buffer.byteLength(raw)>25*1024*1024)throw Error("OUTCOME_FILE_TOO_LARGE");
 const outcomes=JSON.parse(raw);
 const checkpoint=checkpointPath?JSON.parse(readFileSync(checkpointPath,"utf8")):null;
 return auditLocalResearchBatch(records,outcomes,{checkpoint});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const a=process.argv.slice(2);
 if(a.length<2||a.length>3||a.some(x=>x.startsWith("-"))){process.stderr.write("Usage: node scripts/report-local-research-batch.mjs ledger.jsonl outcomes.json [checkpoint.json]\n");process.exitCode=2;}
 else try{const r=reportBatchFromFiles(...a);process.stdout.write(JSON.stringify(r,null,2)+"\n");if(!r.safe)process.exitCode=1;}
 catch(e){process.stderr.write("Batch rejected: "+e.message+"\n");process.exitCode=1;}
}
