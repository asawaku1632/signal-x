#!/usr/bin/env node
/**
 * Manual local-file only. Prints a DESCRIPTIVE report; no SQL, secrets,
 * production writes, network, app UI, notification or live prediction.
 * Usage: node scripts/report-saved-price-exploration.mjs ./approved-export.json
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {parseResearchFile} from "./report-prior-score-robustness.mjs";
import {describeSavedPriceCohorts} from "../app/lib/research/savedPriceExploration.mjs";
import {classifyResearchUse} from "../app/lib/research/researchUseTiers.mjs";
export function exploratoryReportFromText(raw,options){
 const rows=parseResearchFile(raw);
 // Supports original SQL snake_case export without auto-asserting provenance.
 const formatted=rows.map(row=>row&&typeof row==="object"?{
   ...row,price:row.price,nextPrice:row.nextPrice??row.next_price,
   priorScore:row.priorScore??row.prior_score,
   sourceLinked:row.sourceLinked===true||row.source_linked===true
 }:row);
 const tiers=classifyResearchUse(formatted);
 const exploration=describeSavedPriceCohorts(rows,options);
 return {reportType:"NON_TRADABLE_HISTORICAL_EXPLORATION",inputRows:rows.length,
  useTiers:tiers.summary,strictVerified:0,exploration,
  independentSourceVerification:false,liveSignalEnabled:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith("-")){process.stderr.write("Usage: node scripts/report-saved-price-exploration.mjs <approved-export.json>\n");process.exitCode=2;}
 else try{process.stdout.write(JSON.stringify(exploratoryReportFromText(readFileSync(args[0],"utf8")),null,2)+"\n");}
 catch(e){process.stderr.write("Exploration input rejected: "+e.message+"\n");process.exitCode=1;}
}
