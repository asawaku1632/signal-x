#!/usr/bin/env node
// Offline, aggregate-only review. No DB connections, network requests, or writes.
// Usage: node scripts/research/legacy-aggregate-review.mjs ./authorized-aggregate-export.json
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectLegacyAggregateExport} from '../../lib/research/marketBreadthLegacyAggregateIntake.mjs';
const MAX_BYTES=4*1024*1024;
export async function reviewLegacyAggregateFile(filePath){
 if(typeof filePath!=='string'||!filePath.trim())throw new TypeError('LOCAL_AGGREGATE_FILE_REQUIRED');
 const path=resolve(filePath),info=await stat(path);
 if(!info.isFile()||info.size>MAX_BYTES)throw new TypeError('AGGREGATE_FILE_INVALID_OR_TOO_LARGE');
 const raw=await readFile(path,'utf8');
 if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw new TypeError('AGGREGATE_FILE_TOO_LARGE');
 let data;try{data=JSON.parse(raw)}catch{throw new TypeError('INVALID_AGGREGATE_JSON')}
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(k=>!['summary','daily','duplicates'].includes(k)))throw new TypeError('UNEXPECTED_AGGREGATE_EXPORT_FIELDS');
 return inspectLegacyAggregateExport(data);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==3)throw new TypeError('USAGE: node scripts/research/legacy-aggregate-review.mjs <local-aggregate.json>');
  process.stdout.write(JSON.stringify(await reviewLegacyAggregateFile(process.argv[2]),null,2)+'\n');
 }catch(error){
  // Never echo file contents, source paths, credentials, or raw DB records.
  process.stderr.write('AGGREGATE_REVIEW_FAILED: '+(error?.message??'UNKNOWN_ERROR')+'\n');
  process.exitCode=1;
 }
}
