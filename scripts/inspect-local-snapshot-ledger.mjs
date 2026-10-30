#!/usr/bin/env node
/** Explicit local-only ledger inspector. Reads an approved file, never writes. */
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {readLocalSnapshotLedger,inspectLocalSnapshotLedger} from "../app/lib/research/localSnapshotLedger.mjs";
export function inspectLocalLedgerFile(path){
 const records=readLocalSnapshotLedger(path);
 const result=inspectLocalSnapshotLedger(records);
 return {...result,localOnly:true,externallyAuthenticated:false,signalEnabled:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith("-")){process.stderr.write("Usage: node scripts/inspect-local-snapshot-ledger.mjs <local-ledger.jsonl>\n");process.exitCode=2;}
 else try{process.stdout.write(JSON.stringify(inspectLocalLedgerFile(args[0]),null,2)+"\n");}
 catch(e){process.stderr.write("Ledger rejected: "+e.message+"\n");process.exitCode=1;}
}
