import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reviewMarketBreadthForwardFile} from '../../scripts/research/market-breadth-forward-review.mjs';
const script=fileURLToPath(new URL('../../scripts/research/market-breadth-forward-review.mjs',import.meta.url));
async function withFile(contents,fn){
 const dir=await mkdtemp(join(tmpdir(),'breadth-review-'));
 try{const file=join(dir,'input.json');await writeFile(file,contents);return await fn(file)}finally{await rm(dir,{recursive:true,force:true})}
}
test('local read-only CLI returns zero evidence for empty bundle',async()=>withFile(JSON.stringify({schemaVersion:'market-breadth-forward-bundle-v1',entries:[]}),async file=>{
 const result=await reviewMarketBreadthForwardFile(file);assert.equal(result.linkedCount,0);assert.equal(result.productionEligible,false);
 const run=spawnSync(process.execPath,[script,file],{encoding:'utf8'});assert.equal(run.status,0);assert.equal(JSON.parse(run.stdout).submittedCount,0);
}));
test('malformed JSON fails without echoing sensitive input',async()=>withFile('{"secret":"DO_NOT_ECHO",',async file=>{
 await assert.rejects(reviewMarketBreadthForwardFile(file),/INVALID_INPUT_JSON/);
 const run=spawnSync(process.execPath,[script,file],{encoding:'utf8'});assert.equal(run.status,1);assert.doesNotMatch(run.stderr,/DO_NOT_ECHO/);
}));
test('missing file fails closed',async()=>{await assert.rejects(reviewMarketBreadthForwardFile('/not-existing-breadth-bundle-123.json'))});
test('oversized file is rejected before parsing',async()=>withFile(' '.repeat(8*1024*1024+1),async file=>{
 await assert.rejects(reviewMarketBreadthForwardFile(file),/TOO_LARGE/);
}));
test('no file argument fails without accessing network',()=>{const run=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.equal(run.status,1);assert.match(run.stderr,/USAGE/)});
