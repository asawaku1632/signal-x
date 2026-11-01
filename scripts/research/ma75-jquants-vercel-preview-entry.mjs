#!/usr/bin/env node
/**
 * No-flag child entrypoint for Windows Vercel CLI env run.
 *
 * In Vercel CLI 59.7 on Windows PowerShell, forwarded --from/--to arguments
 * can be rejected by the CLI before Node is launched. This entrypoint takes
 * only explicit local wrapper environment variables; it NEVER launches a
 * provider call without the wrapper's opt-in consent and API credential.
 *
 * Shadow-only. No production deploy, DB write, cron, scoring or notification.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  parseMa75BulkArgs,runMa75BulkResearch
} from './ma75-jquants-bulk-retrospective.mjs';

export function argsForMa75PreviewChild(env={}){
  if(env.SIGNALX_MA75_LOCAL_BULK_EXECUTE!=='YES'||
     env.SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY!=='YES')
    throw new TypeError('EXPLICIT_RESEARCH_EXECUTION_CONSENT_REQUIRED');
  const args=[
    '--from='+String(env.SIGNALX_MA75_LOCAL_FROM??''),
    '--to='+String(env.SIGNALX_MA75_LOCAL_TO??''),
    '--execute'
  ];
  parseMa75BulkArgs(args);
  if(typeof env.JQUANTS_API_KEY!=='string'||!env.JQUANTS_API_KEY.trim()||
     ['[SENSITIVE]','[REDACTED]'].includes(env.JQUANTS_API_KEY))
    throw new TypeError('PRIVATE_JQUANTS_KEY_NOT_AVAILABLE_IN_PREVIEW_CHILD');
  return args;
}

export async function runMa75PreviewChild({
 env=process.env,run=runMa75BulkResearch
}={}){
 const args=argsForMa75PreviewChild(env);
 return run(args,{env});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runMa75PreviewChild()
  .then(result=>process.stdout.write(JSON.stringify(result)+'\n'))
  .catch(()=>{
    // Never print env, secrets, provider response bodies or raw market records.
    process.stderr.write('MA75_PREVIEW_CHILD_BLOCKED_OR_PROVIDER_READ_FAILED\n');
    process.exitCode=1;
  });
}
