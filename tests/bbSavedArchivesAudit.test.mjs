import test from "node:test";
import assert from "node:assert/strict";
import {inspectCaptureMetadata,auditSavedCaptures} from "../scripts/research/audit-bb-saved-archives.mjs";
import {isTseTradingDate} from "../app/lib/technicalObservation/tseMarketCalendar.ts";
const days=[];
for(let t=Date.parse("2026-09-25T00:00:00Z");t<=Date.parse("2026-11-04T00:00:00Z");t+=86400000){
 const d=new Date(t).toISOString().slice(0,10);
 if(isTseTradingDate(d))days.push(d);
}
const bench={benchmark:"TOPIX",closes:days.map((d,i)=>({date:d,close:3000+i}))};
const archive=(code,dates)=>({code,minuteDays:dates.map(date=>({date,pages:[]})),
 dailyDays:dates.map(date=>({date,pages:[]}))});
test("read only audit finds exact-date cohorts and refuses to overstate readiness",()=>{
 const a=archive("3762",days.slice(7,12)),b=archive("7203",days.slice(7,12));
 const other=archive("7752",days.slice(8,12));
 const entries=[[a,"3762",7,11],[b,"7203",7,11],[other,"7752",8,11]].map(([capture,code,start,end])=>({
  file:"four-pattern-jquants-"+code+"-"+days[start]+"-"+days[end]+".json",capture
 }));
 const result=auditSavedCaptures({benchmark:bench,folderEntries:entries});
 assert.equal(result.cohorts.length,2);
 assert.equal(result.cohorts[0].stocks,2);
 assert.equal(result.cohorts[0].tradingDates,5);
 assert.equal(result.cohorts[0].eligibleAsOneSharedCohort,true);
 assert.equal(result.eligibleForProduction,false);
});
test("duplicate code and date cohort is not counted twice",()=>{
 const a=archive("3762",days.slice(7,12));
 const file="four-pattern-jquants-3762-"+days[7]+"-"+days[11]+".json";
 const r=auditSavedCaptures({benchmark:bench,folderEntries:[{file,capture:a},{file,capture:a}]});
 assert.equal(r.totalValidFiles,1);
 assert.equal(r.rejectedCount,1);
});
test("missing dates, invalid page metadata and unready benchmark are blocked or labeled",()=>{
 assert.throws(()=>inspectCaptureMetadata(archive("3762",[days[8],days[7]])),/INVALID_ARCHIVE_DATE_OR_PAGES/);
 const a=archive("3762",days.slice(0,3));
 const file="four-pattern-jquants-3762-"+days[0]+"-"+days[2]+".json";
 const r=auditSavedCaptures({benchmark:bench,folderEntries:[{file,capture:a}]});
 assert.equal(r.cohorts[0].eligibleAsOneSharedCohort,false);
 assert.equal(r.cohorts[0].benchmarkReadySessions,0);
});
