import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  sealMorningProbeArchive,verifyMorningProbeArchive,
  summarizeMorningProbeArchives,MORNING_PROBE_ARCHIVE_VERSION
} from "../../app/lib/research/morningProbeArchive.mjs";
import {evaluateMorningProbe,MORNING_PROBE_POLICY}
  from "../../app/lib/research/morningProbeShadow.mjs";

const day="2026-11-04";
const at=(time)=>day+"T"+time+"+09:00";
const candle=(t)=>({time:Date.parse(at(t))/1000,
  open:100,high:102,low:99,close:101,volume:30000});
const goodBars=["09:00","09:05","09:10"].map(candle);
const makeRecord=(code="5333",opts={})=>
  evaluateMorningProbe({
    tradeDate:day,code,requestedAt:at("09:15:25"),
    receivedAt:at("09:15:32"),bars:goodBars,...opts,
  });
const makeBatch=(opts={})=>({
  policy:MORNING_PROBE_POLICY,status:"REFERENCE_RESEARCH_ONLY",
  date:day,priorDate:"2026-11-02",slot:"09:15",
  serverStartedAt:at("09:15:20"),serverFinishedAt:at("09:15:50"),
  cohortFrozenAt:"2026-11-02T18:10:00+09:00",
  frozenCodes:["5333","8316"],
  probes:[makeRecord("5333"),makeRecord("8316")],...opts,
});
test("two genuine completed as-of 09:15 observations can be sealed",()=>{
  const archive=sealMorningProbeArchive(makeBatch());
  assert.equal(archive.evidence.archiveVersion,MORNING_PROBE_ARCHIVE_VERSION);
  assert.equal(archive.evidence.probes.length,2);
  assert.equal(archive.evidence.fillEvidence,false);
  assert.match(archive.checksum.digest,/^[0-9a-f]{64}$/);
  assert.equal(verifyMorningProbeArchive(archive),true);
});
test("valid archive is deterministic for identical captured JSON",()=>{
  assert.deepEqual(sealMorningProbeArchive(makeBatch()),sealMorningProbeArchive(makeBatch()));
});
test("cannot claim a market fill from the captured 5-minute opens",()=>{
  const archive=sealMorningProbeArchive(makeBatch());
  assert.equal(archive.evidence.fillEvidence,false);
  assert.equal(archive.evidence.priceForecastEvidence,false);
});
test("tampering with saved price, status or source breaks the checksum",()=>{
  const x=sealMorningProbeArchive(makeBatch());
  const one=JSON.parse(JSON.stringify(x));
  one.evidence.probes[0].observedBars[0].open=1000000;
  assert.equal(verifyMorningProbeArchive(one),false);
  const two=JSON.parse(JSON.stringify(x));
  two.evidence.probes[0].status="AVAILABLE_AS_OF_RECEIPT_ALT";
  assert.equal(verifyMorningProbeArchive(two),false);
  const three=JSON.parse(JSON.stringify(x));
  three.evidence.source="not the recorded source";
  assert.equal(verifyMorningProbeArchive(three),false);
});
test("a checksum isn't a server signature; no authenticity claim",()=>{
  const r=sealMorningProbeArchive(makeBatch());
  assert.match(r.evidence.note,/not a signature/i);
});
test("a forged frozen date after 09:00 target session is rejected",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    cohortFrozenAt:"2026-11-04T09:20:00+09:00",
  })),/TIMELINE/);
});
test("previous-night time cannot be earlier than prior 18:00 for this policy",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    cohortFrozenAt:"2026-11-02T17:30:00+09:00",
  })),/TIMELINE/);
});
test("malformed pre-holiday prior date is rejected",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    priorDate:"2026-11-31",
  })),/PRIOR_DATE/);
});
test("a mismatched or duplicate frozen symbol is rejected",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    frozenCodes:["5333","5333"],
  })),/COHORT_CODES/);
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    frozenCodes:["5333","9984"],
  })),/OBSERVATION/);
});
test("invalid four-character stock code cannot be archived",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    frozenCodes:["5333","????"],
  })),/COHORT_CODES/);
});
test("duplicate probe response for the same stock is not counted twice",()=>{
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    probes:[makeRecord("5333"),makeRecord("5333")],
  })),/OBSERVATION/);
});
test("receivedAt before requestedAt is invalid",()=>{
  const record={...makeRecord("5333"),receivedAt:at("09:15:24")};
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    probes:[record,makeRecord("8316")],
  })),/RECEIPT_TIME/);
});
test("a five-minute slot rollover prevents sealing a prior-slot observation",()=>{
  const record={...makeRecord("5333"),receivedAt:at("09:20:00")};
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    serverFinishedAt:at("09:20:02"),
    probes:[record,makeRecord("8316")],
  })),/SLOT_ROLLOVER/);
});
test("missing 09:05 quote is preserved as missing, not a loss or a win",()=>{
  const missing=makeRecord("8316",{bars:[candle("09:00"),candle("09:10")]});
  assert.equal(missing.status,"MISSING_COMPLETED_BARS");
  const x=sealMorningProbeArchive(makeBatch({
    probes:[makeRecord("5333"),missing],
  }));
  assert.equal(x.evidence.probes[1].status,"MISSING_COMPLETED_BARS");
  const summary=summarizeMorningProbeArchives([x]);
  assert.equal(summary.bySlot[0].observed,2);
  assert.equal(summary.bySlot[0].available,1);
  assert.equal(summary.bySlot[0].missing,1);
  assert.equal(summary.bySlot[0].availabilityPercent,50);
  assert.equal(summary.performanceClaimsAllowed,false);
});
test("error from Yahoo counts as an observation failure, not dropped data",()=>{
  const fail={code:"8316",tradeDate:day,probeSlot:"09:15",
    requestedAt:at("09:15:25"),receivedAt:at("09:15:32"),
    status:"UPSTREAM_HTTP_ERROR",upstreamHttpStatus:429};
  const x=sealMorningProbeArchive(makeBatch({
    probes:[makeRecord("5333"),fail],
  }));
  const s=summarizeMorningProbeArchives([x]);
  assert.equal(s.bySlot[0].observed,2);
  assert.equal(s.bySlot[0].errors,1);
});
test("the same symbol and slot saved twice cannot bias availability upward",()=>{
  const x=sealMorningProbeArchive(makeBatch());
  const s=summarizeMorningProbeArchives([x,x]);
  assert.equal(s.validEntries,0);
  assert.equal(s.ambiguousDuplicates,2);
  assert.equal(s.bySlot[0].availabilityPercent,null);
});
test("tampered files are rejected and never included in denominator",()=>{
  const x=sealMorningProbeArchive(makeBatch());
  const invalid=JSON.parse(JSON.stringify(x));
  invalid.checksum.digest="0".repeat(64);
  const s=summarizeMorningProbeArchives([x,invalid]);
  assert.equal(s.validEntries,2);
  assert.equal(s.invalidFiles,1);
});
test("empty file list shows no fake perfect feed success",()=>{
  const s=summarizeMorningProbeArchives([]);
  assert.equal(s.validEntries,0);
  assert.equal(s.bySlot[0].availabilityPercent,null);
  assert.equal(s.performanceClaimsAllowed,false);
});
test("manual route generates evidence but contains no DB writes or scheduled jobs",()=>{
  const route=readFileSync("app/api/admin/morning-probe-shadow/route.ts","utf8");
  const ui=readFileSync("app/admin/night-morning-watch/MorningProbeDownload.tsx","utf8");
  const vercel=readFileSync("vercel.json","utf8");
  assert.match(route,/sealMorningProbeArchive\(batch\)/);
  assert.match(route,/serverStartedAt:requestedAt.toISOString\(\)/);
  assert.match(route,/cohortFrozenAt:new Date\(freezeAt\).toISOString\(\)/);
  assert.doesNotMatch(route,/INSERT INTO|DELETE FROM|UPDATE public/);
  assert.doesNotMatch(vercel,/morning-probe-shadow/);
  assert.match(ui,/onClick=\{download\}/);
  assert.match(ui,/new Blob\(/);
  assert.match(ui,/anchor\.download=filename/);
});
test("a forged archive claiming it knew a future candle is rejected",()=>{
  const x=makeRecord("5333");
  const fake={...x,observedBars:[...x.observedBars,{
    slot:"09:20",barStartAt:at("09:20:00"),
    barClosedByReceipt:true,open:100,close:101,volume:2000,
  }]};
  assert.throws(()=>sealMorningProbeArchive(makeBatch({
    probes:[fake,makeRecord("8316")],
  })),/LEAKED_BAR/);
});
