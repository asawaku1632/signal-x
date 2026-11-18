#!/usr/bin/env node
/** Offline only. Reuses the existing original-source integrity-checked review. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runMa75NextSignalLocal} from './ma75-next-signal-local.mjs';
import {auditMa75ProspectivePath}
 from '../../app/lib/research/ma75ProspectivePathAttribution.mjs';
const EXPECTED_SHA='84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab';
export function runMa75PathAudit(args=[]){
 if(args.length)throw new Error('MA75_PATH_AUDIT_NO_ARGUMENTS');
 const r=runMa75NextSignalLocal(['--review']);
 return auditMa75ProspectivePath(r,{expectedLockSha256:EXPECTED_SHA,expectedSize:25});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(runMa75PathAudit(process.argv.slice(2)),null,2)+'\n')}
 catch(e){process.stderr.write((e?.message||'MA75_PATH_AUDIT_BLOCKED')+'\n');process.exitCode=1}
}
