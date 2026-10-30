import test from "node:test";import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";import {join,resolve} from "node:path";
import {prospectiveReadinessFromText} from "../scripts/report-prospective-readiness.mjs";
test("empty input blocks every deployment path",()=>{const x=prospectiveReadinessFromText("[]");assert.equal(x.stability.dates,0);assert.equal(x.trainingEnabled,false);assert.equal(x.notificationsEnabled,false);assert.ok(x.blockers.includes("INSUFFICIENT_DATES"));});
test("invalid payload rejected",()=>assert.throws(()=>prospectiveReadinessFromText("{}")));
test("oversize input rejected",()=>assert.throws(()=>prospectiveReadinessFromText(" ".repeat(5*1024*1024+1)),/INVALID_READINESS_FILE/));
test("actual command prints offline readiness JSON",()=>{const dir=mkdtempSync(join(tmpdir(),"signalx-readiness-"));try{const file=join(dir,"approved.json");writeFileSync(file,"[]");const p=spawnSync(process.execPath,[resolve("scripts/report-prospective-readiness.mjs"),file],{encoding:"utf8",timeout:5000});assert.equal(p.status,0,p.stderr);const result=JSON.parse(p.stdout);assert.equal(result.hasLiveSource,false);assert.equal(result.reviewOnly,true);assert.equal(result.tradingEnabled,false);}finally{rmSync(dir,{recursive:true,force:true});}});
