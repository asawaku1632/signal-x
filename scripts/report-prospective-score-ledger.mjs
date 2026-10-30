#!/usr/bin/env node
/** Manual, offline forward shadow ledger report. Does not connect to production. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {parseResearchFile} from "./report-prior-score-robustness.mjs";
import {auditProspectiveScoreLedger} from "../app/lib/research/prospectiveScoreLedger.mjs";
export function prospectiveLedgerFromText(raw){
 const rows=parseResearchFile(raw);
 const audit=auditProspectiveScoreLedger(rows);
 return {source:"MANUALLY_APPROVED_LOCAL_FILE",experimental:true,hasLiveSource:false,...audit};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const argv=process.argv.slice(2);
 if(argv.length!==1||argv[0].startsWith("-")){process.stderr.write("Usage: node scripts/report-prospective-score-ledger.mjs <approved-file.json>\n");process.exitCode=2;}
 else try{process.stdout.write(JSON.stringify(prospectiveLedgerFromText(readFileSync(argv[0],"utf8")),null,2)+"\n");}
 catch(e){process.stderr.write("Shadow ledger input rejected: "+e.message+"\n");process.exitCode=1;}
}
