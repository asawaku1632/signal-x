import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL(
 '../scripts/research/ma75-run-local-jquants.ps1',import.meta.url
),'utf8');
const bulk=readFileSync(new URL(
 '../scripts/research/ma75-jquants-bulk-retrospective.mjs',import.meta.url
),'utf8');

test('local licensed provider PowerShell wrapper requires explicit execute',()=>{
 assert.match(script,/\[switch\]\$Execute/);
 assert.match(script,/if \(-not \$Execute\)/);
 assert.match(script,/& node @nodeArgs '--execute'/);
 assert.match(script,/& node @nodeArgs\s*\n\s*if/);
});

test('local runner does not depend on Vercel CLI or store API key to disk',()=>{
 assert.doesNotMatch(script,/vercel env|env pull|\.env\.local|Set-Content|Out-File|Write-Host|curl/);
 assert.match(script,/Read-Host .* -AsSecureString/);
 assert.match(script,/SetEnvironmentVariable\('JQUANTS_API_KEY',\$plainKey,'Process'\)/);
});

test('local runner restores process environment and zeroes native secret copy',()=>{
 assert.match(script,/finally \{/);
 assert.match(script,/SetEnvironmentVariable\('JQUANTS_API_KEY',\$priorKey,'Process'\)/);
 assert.match(script,/SetEnvironmentVariable\('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY',\$priorConsent,'Process'\)/);
 assert.match(script,/ZeroFreeBSTR\(\$keyPtr\)/);
 assert.doesNotMatch(script,/Write-Output .*plainKey|Write-Host .*plainKey/);
});

test('bulk research emits safe structural progress and never logs API key',()=>{
 assert.match(bulk,/onProgress=()=>\{\}/);
 for(const phase of ['CALENDAR_START','CALENDAR_READY','DAY_START',
  'DAY_COMPLETE','ANALYSIS_START','ANALYSIS_COMPLETE'])
  assert.ok(bulk.includes("phase:'"+phase+"'"));
 assert.match(bulk,/process\.stderr\.write\('MA75_PROGRESS '/);
 assert.doesNotMatch(bulk,/onProgress\(\{[^}]*key/);
});
