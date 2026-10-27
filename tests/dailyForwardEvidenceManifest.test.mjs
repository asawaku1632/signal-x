import test from "node:test";
import assert from "node:assert/strict";
import { attachForwardResearchEvidence } from "../app/lib/research/dailyForwardEvidenceManifest.mjs";
const p={proposalId:"FORWARD-10-20-39",researchDecision:"IMPROVEMENT_CANDIDATE"};
const meta={datasetId:"offline-fixture-001",datasetSha256:"a".repeat(64),sourceName:"JQUANTS_V2",sourceVersion:"v2",sessionCalendarId:"jp-trading-calendar-2026",evaluationCommit:"0123456789abcdef",cutoffDate:"2026-10-01",reviewTimestamp:"2026-10-27T10:00:00Z"};
test("complete metadata is traceable but not certified or approved",()=>{
  const [r]=attachForwardResearchEvidence([p],meta);
  assert.equal(r.evidence.status,"TRACEABLE_METADATA_ONLY");
  assert.equal(r.evidence.datasetSha256,"a".repeat(64));
  assert.equal(r.evidence.licenseReview,"NOT_VERIFIED");
  assert.equal(r.readiness,"NOT_READY_FOR_PRODUCTION");
  assert.equal(r.autoApply,false);
});
test("missing hash and source information fail closed",()=>{
  const [r]=attachForwardResearchEvidence([p],{...meta,datasetSha256:"invalid",sourceName:""});
  assert.equal(r.evidence.status,"INCOMPLETE_METADATA");
  assert.equal(r.evidence.datasetSha256,null);
  assert.ok(r.evidence.missingFields.includes("VALID_SHA256"));
  assert.ok(r.evidence.missingFields.includes("sourceName"));
});
test("review flags cannot be inferred from source name or hash",()=>{
  const [r]=attachForwardResearchEvidence([p],{...meta,priceBasisReview:"unknown",licenseReview:"unknown"});
  assert.equal(r.evidence.priceBasisReview,"NOT_VERIFIED");
  assert.equal(r.evidence.licenseReview,"NOT_VERIFIED");
});
test("rejects malformed proposals",()=>{
  assert.throws(()=>attachForwardResearchEvidence(null,meta),TypeError);
});
