import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=(p)=>readFileSync(path.join(root,p),"utf8");

test("dual surge admin route denies non-owner before rendering research client",()=>{
 const source=read("app/admin/dual-surge-shadow/page.tsx");
 assert.match(source,/getLearningOwnerSession\s*\(/);
 assert.match(source,/if\s*\(\s*!isOwner\s*\)\s*notFound\s*\(/);
 const guard=source.indexOf("if(!isOwner)notFound()");
 const client=source.indexOf("<DualSurgeClient");
 assert.ok(guard>=0 && client>guard,"owner guard must precede research client");
});

test("dual surge replay remains offline and explicitly unapproved for production",()=>{
 const source=read("app/lib/research/dualSurgeRawReplay.mjs");
 assert.match(source,/providerRequests\s*:\s*0/);
 assert.match(source,/productionApproved\s*:\s*false/);
 assert.match(source,/readOnly\s*:\s*true/);
 for(const forbidden of [/\bfetch\s*\(/,/\baxios\b/,/\bcreateClient\s*\(/,/\bprocess\.env\b/]){
  assert.doesNotMatch(source,forbidden);
 }
});

test("reference events preserve unique identity and matured-pending separation",()=>{
 const doc=JSON.parse(read("docs/research/dual-surge-user-diagnostic-events-20261025.json"));
 assert.equal(doc.events.length,24);
 const keys=new Set();
 let matured=0,pending=0,positive=0,negative=0;
 for(const e of doc.events){
  const key=[e.code,e.cohort,e.startDate].join("|");
  assert.ok(!keys.has(key),"duplicate "+key);keys.add(key);
  if(e.status==="MATURED"){matured++;assert.ok(Number.isFinite(e.returnPct));if(e.returnPct>0)positive++;else if(e.returnPct<0)negative++;}
  else {assert.equal(e.status,"PENDING");assert.equal(e.returnPct,null);pending++;}
 }
 assert.deepEqual({matured,pending,positive,negative},{matured:15,pending:9,positive:11,negative:4});
 assert.match(doc.limitations.join(" "),/not independently fetched J-Quants OHLCV/i);
});
