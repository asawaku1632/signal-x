import test from "node:test";
import assert from "node:assert/strict";
import { hashResearchDatasetBytes, verifyResearchDatasetBytes } from "../app/lib/research/dailyForwardDatasetIntegrity.mjs";
const original=Buffer.from('{"code":"7203","date":"2026-10-01","close":100}\n',"utf8");
test("unchanged exact dataset bytes match trusted SHA-256",()=>{
  const expected=hashResearchDatasetBytes(original);
  const result=verifyResearchDatasetBytes(original,expected);
  assert.equal(result.matches,true);
  assert.equal(result.status,"MATCH");
  assert.equal(result.readyForProduction,false);
});
test("single-byte changes are detected",()=>{
  const expected=hashResearchDatasetBytes(original);
  const modified=Buffer.from('{"code":"7203","date":"2026-10-01","close":101}\n',"utf8");
  assert.equal(verifyResearchDatasetBytes(modified,expected).matches,false);
});
test("missing or malformed expected digest fails closed",()=>{
  assert.equal(verifyResearchDatasetBytes(original,"invalid").matches,false);
  assert.equal(verifyResearchDatasetBytes(original,null).expectedSha256,null);
});
test("only exact bytes are accepted, not parsed objects",()=>{
  assert.throws(()=>hashResearchDatasetBytes({rows:[]}),TypeError);
});
