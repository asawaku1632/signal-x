import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const reportName = /^(?:\d{4}|\d{3}[A-Z])_20\d\d-\d\d-\d\d\.json$/;
export function inventoryDirectory(directory) {
  const files = readdirSync(directory, {withFileTypes:true});
  const summary = {version:'post905_local_source_inventory_v1', scannedJson:0, minuteReportFiles:0, otherJsonFiles:0, invalidReportFiles:0, reportScopes:[], historicalOnly:true, verifiedTradingEdge:false, eligibleForProduction:false, eligibleForNotifications:false};
  const scopes = new Set();
  for (const entry of files) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    summary.scannedJson++;
    if (!reportName.test(entry.name)) {summary.otherJsonFiles++;continue;}
    summary.minuteReportFiles++;
    const scope=entry.name.slice(0,-5);
    if (scopes.has(scope)) throw new Error('DUPLICATE_SCOPE');
    scopes.add(scope);
    try {
      const report=JSON.parse(readFileSync(join(directory,entry.name),'utf8'));
      if (!report || typeof report!=='object'||Array.isArray(report)) throw new Error('INVALID_REPORT');
      summary.reportScopes.push(scope);
    } catch { summary.invalidReportFiles++; }
  }
  summary.reportScopes.sort();
  return summary;
}
export function main(argv) {
  if (argv.length!==2 || !argv[0].startsWith('--dir=') || !argv[1].startsWith('--output=')) throw new Error('ARGUMENTS_REQUIRED');
  const directory=resolve(argv[0].slice(6)),output=resolve(argv[1].slice(9));
  if (directory===output) throw new Error('INVALID_OUTPUT');
  const summary=inventoryDirectory(directory);
  writeFileSync(output,JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
  return {status:'LOCAL_SOURCE_INVENTORY_CREATED',reportFiles:summary.minuteReportFiles,invalid:summary.invalidReportFiles,output};
}
if (process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(JSON.stringify(main(process.argv.slice(2))));}
  catch(e){console.error('LOCAL_SOURCE_INVENTORY_FAILED:',e.code==='EEXIST'?'OUTPUT_EXISTS':e.message);process.exitCode=1;}
}
