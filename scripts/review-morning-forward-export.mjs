#!/usr/bin/env node
/** Local/offline JSON inspection. Does not contact any network or database. */
import {readFile} from "node:fs/promises";
import {reviewMorningForwardExport} from "../app/lib/research/morningForwardExportReview.mjs";
const path=process.argv[2];
if(!path||process.argv.length!==3){console.error("Usage: node scripts/review-morning-forward-export.mjs <local-input.json>");process.exitCode=2;}
else {
 try {
  const stat=await import("node:fs/promises").then(fs=>fs.stat(path));
  if(stat.size>10_000_000)throw Error("EXPORT_EXCEEDS_SIZE_LIMIT");
  const records=JSON.parse(await readFile(path,"utf8"));
  const audit=reviewMorningForwardExport(records);
  process.stdout.write(JSON.stringify(audit,null,2)+"\n");
 } catch(e){console.error("MORNING_FORWARD_EXPORT_REJECTED: "+(e?.message??String(e)));process.exitCode=1;}
}
