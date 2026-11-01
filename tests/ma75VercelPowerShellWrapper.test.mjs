import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wrapper=readFileSync(
 new URL('../scripts/research/ma75-run-with-vercel-preview.ps1',import.meta.url),
 'utf8'
);
const entry=readFileSync(
 new URL('../scripts/research/ma75-jquants-vercel-preview-entry.mjs',import.meta.url),
 'utf8'
);

test('Windows Vercel Preview launcher never forwards unknown --from or --to CLI flags',()=>{
 assert.match(wrapper,
  /& vercel env run -e preview --git-branch \$expectedBranch -- node \$childScript/);
 assert.doesNotMatch(wrapper,/vercel env run[^\n]*--from/);
 assert.doesNotMatch(wrapper,/vercel env run[^\n]*@arguments/);
 assert.match(wrapper,/\$childScript = 'scripts\/research\/ma75-jquants-vercel-preview-entry\.mjs'/);
});
test('Windows wrapper requires explicit user -Execute and validates team link',()=>{
 assert.match(wrapper,/\[switch\]\$Execute/);
 assert.match(wrapper,/if \(-not \$Execute\)/);
 assert.match(wrapper,/\$link\.projectId -ne \$expectedProjectId/);
 assert.match(wrapper,/\$link\.orgId -ne \$expectedOrgId/);
 assert.match(wrapper,/\$env:SIGNALX_MA75_LOCAL_BULK_EXECUTE = 'YES'|SIGNALX_MA75_LOCAL_BULK_EXECUTE' = 'YES'/);
});
test('Windows wrapper restores temporary controls even after a CLI error',()=>{
 assert.match(wrapper,/finally \{/);
 assert.match(wrapper,/SetEnvironmentVariable\(\$name, \$oldSettings\[\$name\], 'Process'\)/);
 assert.doesNotMatch(wrapper,/& vercel (?:env pull|env add|deploy|link)|--prod/);
});
test('child validates private credential and consent before calling provider',()=>{
 const index=entry.indexOf('const args=argsForMa75PreviewChild(env);');
 const provider=entry.indexOf('return run(args,{env})');
 assert.ok(index>=0&&provider>index);
 assert.match(entry,/PRIVATE_JQUANTS_KEY_NOT_AVAILABLE_IN_PREVIEW_CHILD/);
 assert.match(entry,/EXPLICIT_RESEARCH_EXECUTION_CONSENT_REQUIRED/);
 assert.doesNotMatch(entry,/console\.log\(env|writeFileSync/);
});
