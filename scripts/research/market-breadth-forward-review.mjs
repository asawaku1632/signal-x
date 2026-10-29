#!/usr/bin/env node
// Local, read-only JSON intake. No remote calls, DB credentials, notifications, or writes.
// Usage: node scripts/research/market-breadth-forward-review.mjs ./local-forward-bundle.json
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {intakeMarketBreadthForwardBundle} from '../../lib/research/marketBreadthForwardIntake.mjs';
const MAX_BYTES=8*1024*1024;
export async function reviewMarketBreadthForwardFile(filePath){
 if(typeof filePath!=='string'||!filePath.trim())throw new Error('LOCAL_INPUT_PATH_REQUIRED');
 const {stat}=await import('node:fs/promises');
 const path=resolve(filePath);
 const info=await stat(path);
 if(!info.isFile()||info.size>MAX_BYTES)throw new Error('INPUT_NOT_REGULAR_FILE_OR_TOO_LARGE');
 const raw=await readFile(path,'utf8');
 if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw new Error('INPUT_TOO_LARGE');
 let bundle;
 try{bundle=JSON.parse(raw)}catch{throw new Error('INVALID_INPUT_JSON')}
 return intakeMarketBreadthForwardBundle(bundle);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==3)throw new Error('USAGE: node scripts/research/market-breadth-forward-review.mjs <local-bundle.json>');
  const result=await reviewMarketBreadthForwardFile(process.argv[2]);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(error){
  // Do not print raw input, file contents, or provider tokens.
  process.stderr.write('RESEARCH_REVIEW_FAILED: '+(error?.message??'UNKNOWN_ERROR')+'\n');
  process.exitCode=1;
 }
}
