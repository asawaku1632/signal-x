#!/usr/bin/env node
/**
 * Offline historical research report.
 * Usage: node scripts/report-morning-bottom.mjs ./verified-bars.json
 * Input: JSON array of adapter records (licenseVerified must be true).
 * No network calls, writes, notifications or trading actions.
 */
import {readFileSync} from "node:fs";
import {aggregateHistoricalMorning} from "../app/lib/research/morningHistoricalAdapter.mjs";
const path=process.argv[2];
if(!path){
  console.error("Usage: node scripts/report-morning-bottom.mjs <verified-bars.json>");
  process.exitCode=2;
}else{
  try{
    const records=JSON.parse(readFileSync(path,"utf8"));
    const report=aggregateHistoricalMorning(records,{minSamples:30,dropThresholdPct:3,binMinutes:5});
    process.stdout.write(JSON.stringify(report,null,2)+"\n");
    if(!report.eligible)console.error("INSUFFICIENT_EVIDENCE: observed statistics are not a validated forecast.");
  }catch(error){
    console.error("RESEARCH_REPORT_FAILED:",error instanceof Error?error.message:String(error));
    process.exitCode=1;
  }
}
