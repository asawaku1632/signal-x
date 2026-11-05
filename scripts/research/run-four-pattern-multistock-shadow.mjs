#!/usr/bin/env node
/**
 * Local-only multiple J-Quants historical archive reader.
 * Explicit filenames, max 30, each <=8MB, no network or automatic capture.
 * Prints only aggregate synthetic P&L / signal counts; never raw price rows.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 summarizeMultiStockFourPatternArchives,MULTI_STOCK_LIMITS,
} from '../../app/lib/research/fourPatternMultiStockShadow.mjs';

const MAX_ARCHIVE_SIZE=8_000_000;
export function runMultiStockFourPatternLocal(argv){
 if(!Array.isArray(argv)||argv.length<MULTI_STOCK_LIMITS.minArchives||
  argv.length>MULTI_STOCK_LIMITS.maxArchives||argv.some(s=>
   typeof s!=='string'||!s.trim()||s.startsWith('--')))
  throw Error('USAGE_EXPLICIT_PRIVATE_ARCHIVES_1_TO_30');
 const paths=argv.map(path=>resolve(path));
 if(new Set(paths).size!==paths.length)
  throw Error('DUPLICATE_LOCAL_ARCHIVE_PATH');
 const archives=paths.map(path=>{
  const stat=statSync(path);
  if(!stat.isFile()||stat.size>MAX_ARCHIVE_SIZE||stat.size<2)
   throw Error('INVALID_OR_OVERSIZED_ARCHIVE');
  const archive=JSON.parse(readFileSync(path,'utf8'));
  if(!archive||Array.isArray(archive)||typeof archive!=='object')
   throw Error('INVALID_ARCHIVE_PAYLOAD');
  return archive;
 });
 return summarizeMultiStockFourPatternArchives(archives);
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
  const result=runMultiStockFourPatternLocal(process.argv.slice(2));
  console.log(JSON.stringify(result,null,2));
  if(!['MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY',
       'SINGLE_STOCK_PILOT_SHADOW_ONLY'].includes(result.status))
   process.exitCode=1;
 }catch(error){
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'UNVERIFIED_OR_INACCESSIBLE_ARCHIVES';
  console.error('FOUR_PATTERN_MULTISTOCK_BLOCKED',code);
  process.exitCode=1;
 }
}
