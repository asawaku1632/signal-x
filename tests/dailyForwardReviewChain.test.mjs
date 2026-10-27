import test from "node:test";
import assert from "node:assert/strict";
import { sealForwardReviewHistory, verifyForwardReviewHistoryChain } from "../app/lib/research/dailyForwardReviewChain.mjs";
const records=[
 {sequence:1,proposalId:"FORWARD-10-20-39",reviewerId:"researcher",reviewedAt:"2026-10-27T11:00:00Z",decision:"REVIEW_HOLD",reason:"Data pending",evidenceSha256:"a".repeat(64),productionApproval:false,autoApply:false},
 {sequence:2,proposalId:"FORWARD-10-20-39",reviewerId:"researcher",reviewedAt:"2026-10-28T11:00:00Z",decision:"RESEARCH_CANDIDATE",reason:"More checks requested",evidenceSha256:"a".repeat(64),productionApproval:false,autoApply:false},
];
test("sealed chain matches independently preserved expected head",()=>{
 const sealed=sealForwardReviewHistory(records);
 const result=verifyForwardReviewHistoryChain(sealed,sealed.at(-1).recordHash);
 assert.equal(result.valid,true);
 assert.equal(result.recordCount,2);
 assert.equal(result.productionApproved,false);
});
test("changing old review reason breaks chain",()=>{
 const sealed=sealForwardReviewHistory(records);
 const changed=sealed.map((r)=>({...r}));
 changed[0].reason="Modified";
 assert.equal(verifyForwardReviewHistoryChain(changed,sealed.at(-1).recordHash).valid,false);
});
test("recomputing entire chain cannot pass independently pinned old head",()=>{
 const old=sealForwardReviewHistory(records);
 const rewritten=sealForwardReviewHistory([{...records[0],reason:"Rewritten"},records[1]]);
 const result=verifyForwardReviewHistoryChain(rewritten,old.at(-1).recordHash);
 assert.equal(result.valid,false);
 assert.ok(result.issues.includes("TRUSTED_HEAD_MISMATCH_OR_MISSING"));
});
test("missing trusted head fails closed",()=>{
 const sealed=sealForwardReviewHistory(records);
 assert.equal(verifyForwardReviewHistoryChain(sealed,undefined).valid,false);
});
