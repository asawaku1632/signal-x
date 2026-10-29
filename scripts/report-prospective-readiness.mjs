#!/usr/bin/env node
/** Manual offline prospective research readiness report. No production access. */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {parseResearchFile} from "./report-prior-score-robustness.mjs";
import {summarizeProspectiveResearch} from "../app/lib/research/prospectiveResearchReadiness.mjs";
export function prospectiveReadinessFromText(raw){
 if(typeof raw!=="string"||Buffer.byteLength(raw)>5*1024*1024)throw Error("INVALID_READINESS_FILE");
 const rows=parseResearchFile(raw);
 return {source:"MANUALLY_APPROVED_LOCAL_FILE",hasLiveSource:false,...summarizeProspectiveResearch(rows)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith("-")){process.stderr.write("Usage: node scripts/report-prospective-readiness.mjs <approved-file.json>\n");process.exitCode=2;}
 else try{process.stdout.write(JSON.stringify(prospectiveReadinessFromText(readFileSync(args[0],"utf8")),null,2)+"\n");}
 catch(e){process.stderr.write("Readiness input rejected: "+e.message+"\n");process.exitCode=1;}
}
