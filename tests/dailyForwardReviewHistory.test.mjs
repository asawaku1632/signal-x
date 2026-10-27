import test from "node:test";
import assert from "node:assert/strict";
import { appendForwardResearchReview } from "../app/lib/research/dailyForwardReviewHistory.mjs";
const event={proposalId:"FORWARD-10-20-39",reviewerId:"admin-researcher",reviewedAt:"2026-10-27T11:00:00Z",decision:"REVIEW_HOLD",reason:"Waiting for licensed source validation",evidenceSha256:"a".repeat(64)};
test("appends sequenced research-only audit records without mutating history",()=>{
  const old=[];
  const first=appendForwardResearchReview(old,event);
  const next=appendForwardResearchReview(first,{...event,reviewedAt:"2026-10-28T11:00:00Z",decision:"RESEARCH_CANDIDATE",reason:"Independent check requested"});
  assert.equal(old.length,0);
  assert.equal(first.length,1);
  assert.equal(next.length,2);
  assert.equal(next[1].sequence,2);
  assert.equal(next[1].productionApproval,false);
  assert.equal(next[1].autoApply,false);
});
test("rejects missing rationale or reviewer",()=>{
  assert.throws(()=>appendForwardResearchReview([],{...event,reason:""}),/Missing review fields/);
  assert.throws(()=>appendForwardResearchReview([],{...event,reviewerId:""}),/Missing review fields/);
});
test("rejects invalid hash and decision",()=>{
  assert.throws(()=>appendForwardResearchReview([],{...event,evidenceSha256:"bad"}),/hash/);
  assert.throws(()=>appendForwardResearchReview([],{...event,decision:"PRODUCTION_APPROVED"}),/decision/);
});
test("rejects backwards review timestamps",()=>{
  const first=appendForwardResearchReview([],event);
  assert.throws(()=>appendForwardResearchReview(first,{...event,reviewedAt:"2026-10-26T11:00:00Z"}),/timestamps/);
});
