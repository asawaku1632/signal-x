#!/usr/bin/env node
// Offline research replay: never fetches J-Quants or modifies a database.
import {readFileSync} from "node:fs";
import {replayDiagnosticEvents} from "../app/lib/research/dualSurgeRawReplay.mjs";

const [snapshotPath,referencePath="docs/research/dual-surge-user-diagnostic-events-20261025.json"]=process.argv.slice(2);
if(!snapshotPath){
 console.error("Usage: node scripts/dual-surge-offline-replay.mjs <licensed-raw-snapshot.json> [event-reference.json]");
 process.exitCode=2;
}else{
 try{
  const snapshot=JSON.parse(readFileSync(snapshotPath,"utf8"));
  const reference=JSON.parse(readFileSync(referencePath,"utf8"));
  if(snapshot?.licenseVerified!==true||typeof snapshot?.snapshotId!=="string"||!snapshot.snapshotId.trim()||snapshot?.source!=="JQUANTS_V2"||!snapshot?.providerRowsByCode||snapshot?.asOfDate!=="2026-10-23")throw Error("UNVERIFIED_LICENSE_OR_SNAPSHOT");
  if(reference?.source!=="USER_PROVIDED_JQUANTS_V2_READ_ONLY_HISTORICAL_DIAGNOSTICS"||reference.events?.length!==24)throw Error("INVALID_EVENT_REFERENCE");
  const report=replayDiagnosticEvents({referenceEvents:reference.events,providerRowsByCode:snapshot.providerRowsByCode,asOfDate:snapshot.asOfDate});
  const output={...report,snapshotId:snapshot.snapshotId,source:snapshot.source,asOfDate:snapshot.asOfDate,licenseVerified:true,diagnosticOnly:true};
  process.stdout.write(JSON.stringify(output,null,2)+"\n");
  if(!report.allMatched)process.exitCode=1;
 }catch(error){console.error(error?.message??String(error));process.exitCode=2;}
}
