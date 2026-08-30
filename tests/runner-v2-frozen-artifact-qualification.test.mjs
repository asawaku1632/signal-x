import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {createHash,generateKeyPairSync} from "node:crypto";
import {after,before,test} from "node:test";
import {copyFile,lstat,mkdir,mkdtemp,readFile,realpath,rm,stat,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

const EXPECTED_ARTIFACT_SHA="64890858a8dd8c017498f13f3809016a0ed26d1af46339af23791b348f75fcb3";
const EXPECTED_ARTIFACT_SIZE=12800;
const EXPECTED_ARTIFACT_MVID="b5083232-5280-48f2-8379-2a4054d93c1f";
const POWERSHELL="C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const runnerSid="S-1-5-32-545";

let sourceRoot,prebuiltPath,root,trust,keyPath,readerPath,publicKey,provisionerSid,readerHash,readerIdentity;
let createTestTrustedWindowsKeyReadProvider,loadTrustedKeyReadBinding,operatorPublicKeyFingerprint;

function ps(script,{encoding=null}={}){
  return execFileSync(POWERSHELL,["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script],{encoding,windowsHide:true,timeout:30000,stdio:["ignore","pipe","pipe"]});
}
function quotePs(value){return String(value).replaceAll("'","''");}
async function sha256(file){return createHash("sha256").update(await readFile(file)).digest("hex");}
async function mvid(file){
  const escaped=quotePs(file);
  return ps(`([Reflection.Assembly]::ReflectionOnlyLoadFrom('${escaped}')).ManifestModule.ModuleVersionId.ToString()`,{encoding:"utf8"}).trim().toLowerCase();
}
async function inspectPath(target){
  const absolute=path.win32.resolve(target),escaped=quotePs(absolute);
  const acl=JSON.parse(ps(`$ErrorActionPreference='Stop';$p='${escaped}';$i=Get-Item -LiteralPath $p -Force;$s=$i.GetAccessControl([Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access);$o=($s.GetOwner([Security.Principal.SecurityIdentifier])).Value;$e=@();foreach($r in $s.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){$v=$r.FileSystemRights;$q=New-Object Collections.Generic.List[string];if(($v-band[Security.AccessControl.FileSystemRights]::FullControl)-eq[Security.AccessControl.FileSystemRights]::FullControl){$q.Add('FULL_CONTROL')}elseif(($v-band[Security.AccessControl.FileSystemRights]::Modify)-eq[Security.AccessControl.FileSystemRights]::Modify){$q.Add('MODIFY')}if(($v-band[Security.AccessControl.FileSystemRights]::Read)-eq[Security.AccessControl.FileSystemRights]::Read){$q.Add('READ')}if(($v-band[Security.AccessControl.FileSystemRights]::ExecuteFile)-ne 0){$q.Add('EXECUTE')}foreach($n in @('WriteData','AppendData','WriteExtendedAttributes','WriteAttributes','Delete','DeleteSubdirectoriesAndFiles','ChangePermissions','TakeOwnership')){$f=[Security.AccessControl.FileSystemRights][Enum]::Parse([Security.AccessControl.FileSystemRights],$n);if(($v-band$f)-ne 0){$q.Add(($n-replace'([a-z])([A-Z])','$1_$2').ToUpperInvariant())}};$e+=,[PSCustomObject]@{principal=$r.IdentityReference.Value;permissions=@($q);inherited=$r.IsInherited}};[PSCustomObject]@{owner=$o;inheritanceEnabled=(-not$s.AreAccessRulesProtected);entries=$e}|ConvertTo-Json -Depth 8 -Compress`,{encoding:"utf8"}));
  const link=await lstat(absolute),resolved=await realpath(absolute),resolvedStat=await stat(absolute);
  return {ok:true,available:true,absolutePath:absolute,resolvedPath:resolved,type:resolvedStat.isFile()?"file":resolvedStat.isDirectory()?"directory":"other",owner:acl.owner,ownerSidPresent:Boolean(acl.owner),inheritanceEnabled:acl.inheritanceEnabled,isReparsePoint:link.isSymbolicLink(),volumeSerial:String(resolvedStat.dev),fileId:String(resolvedStat.ino),size:resolvedStat.size,lastWriteFileTime:String(resolvedStat.mtimeMs),entries:Array.isArray(acl.entries)?acl.entries:acl.entries?[acl.entries]:[]};
}
const inspector={inspectPath};
function aclScript(target,directory,{inheritance=false,broadWrite=false,runnerWrite=false,runnerRights}={}){
  const escaped=quotePs(target),rights=runnerRights??(directory?"ReadAndExecute":"Read"),inherit=directory?"ContainerInherit, ObjectInherit":"None";
  return `$ErrorActionPreference='Stop';$p='${escaped}';$d=$${directory};$u=[Security.Principal.WindowsIdentity]::GetCurrent().User;$s=if($d){(New-Object IO.DirectoryInfo($p)).GetAccessControl()}else{(New-Object IO.FileInfo($p)).GetAccessControl()};$s.SetAccessRuleProtection($${!inheritance},$false);foreach($r in @($s.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))){$s.RemoveAccessRuleSpecific($r)};$a=[Security.AccessControl.AccessControlType]::Allow;$i=[Security.AccessControl.InheritanceFlags]'${inherit}';$n=[Security.AccessControl.PropagationFlags]::None;$s.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-18')),[Security.AccessControl.FileSystemRights]::FullControl,$i,$n,$a)));$s.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($u,[Security.AccessControl.FileSystemRights]::FullControl,$i,$n,$a)));$s.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('${runnerSid}')),[Security.AccessControl.FileSystemRights]'${rights}',$i,$n,$a)));${broadWrite?"$s.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-11')),[Security.AccessControl.FileSystemRights]::Write,$i,$n,$a)));":""}${runnerWrite?`$s.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('${runnerSid}')),[Security.AccessControl.FileSystemRights]::Delete,$i,$n,$a)));`:""}if($d){(New-Object IO.DirectoryInfo($p)).SetAccessControl($s)}else{(New-Object IO.FileInfo($p)).SetAccessControl($s)}`;
}
async function setKeyAcl(options={}){ps(aclScript(trust,true,options.trust??{}));ps(aclScript(keyPath,false,options.key??options));}
async function setReaderAcl(options={}){ps(aclScript(readerPath,false,{runnerRights:"ReadAndExecute",...options}));}
async function assertFrozenFile(file,{stable=false}={}){
  const info=await lstat(file);assert.equal(info.isFile(),true);assert.equal(info.isSymbolicLink(),false);assert.equal(info.size,EXPECTED_ARTIFACT_SIZE);assert.equal(await sha256(file),EXPECTED_ARTIFACT_SHA);assert.equal(await mvid(file),EXPECTED_ARTIFACT_MVID);
  const resolved=await realpath(file);assert.equal(path.win32.normalize(resolved).toLowerCase(),path.win32.normalize(file).toLowerCase());
  const identity={dev:String(info.dev),ino:String(info.ino),size:info.size,mtimeMs:info.mtimeMs};
  if(stable&&readerIdentity)assert.deepEqual(identity,readerIdentity);
  return identity;
}
async function assertControlledRoot(target){
  const drive=path.win32.parse(path.win32.resolve(target)).root,format=ps(`([IO.DriveInfo]::new('${quotePs(drive)}')).DriveFormat`,{encoding:"utf8"}).trim();assert.equal(format.toUpperCase(),"NTFS");
  const parsed=path.win32.parse(target),parts=path.win32.resolve(target).slice(parsed.root.length).split(/[\\/]+/u).filter(Boolean);let current=parsed.root;
  for(const part of parts){current=path.win32.join(current,part);const item=await lstat(current);assert.equal(item.isSymbolicLink(),false,`controlled component is reparse: ${current}`);assert.equal(path.win32.normalize(await realpath(current)).toLowerCase(),path.win32.normalize(current).toLowerCase());}
}
function reader(overrides={}){return createTestTrustedWindowsKeyReadProvider({helperPath:readerPath,keyPath,trustRoot:trust,runnerSid,provisionerSid,expectedHelperHash:readerHash,helperInspector:inspector,...overrides});}
async function nativeResult(args,{verify=true,helper=readerPath}={}){
  if(verify&&helper===readerPath)await assertFrozenFile(readerPath,{stable:true});
  return new Promise((resolve,reject)=>{const stdout=[],stderr=[],child=spawn(helper,args,{windowsHide:true,stdio:["ignore","pipe","pipe"]});child.stdout.on("data",chunk=>stdout.push(chunk));child.stderr.on("data",chunk=>stderr.push(chunk));child.on("error",reject).on("close",code=>resolve({code,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)}));});
}
async function rightsDecision(objectType,principal,rights){return (await nativeResult(["acl-rights-fixture",objectType,principal,rights])).code;}
async function restoreReader(bytes){await writeFile(readerPath,bytes);await setReaderAcl();readerIdentity=await assertFrozenFile(readerPath);}

before(async()=>{
  assert.equal(process.platform,"win32","Windows runner required");
  prebuiltPath=process.env.SIGNALX_PREBUILT_KEY_READER;sourceRoot=process.env.SIGNALX_FINAL_SOURCE_ROOT;
  assert.ok(prebuiltPath&&path.win32.isAbsolute(prebuiltPath),"SIGNALX_PREBUILT_KEY_READER required");
  assert.equal(process.env.SIGNALX_PREBUILT_KEY_READER_SHA256,EXPECTED_ARTIFACT_SHA);assert.ok(sourceRoot&&path.win32.isAbsolute(sourceRoot),"SIGNALX_FINAL_SOURCE_ROOT required");
  await assertFrozenFile(prebuiltPath);
  ({createTestTrustedWindowsKeyReadProvider,loadTrustedKeyReadBinding}=await import(pathToFileURL(path.join(sourceRoot,"scripts/runner-v2/trusted-windows-key-reader.mjs"))));
  ({operatorPublicKeyFingerprint}=await import(pathToFileURL(path.join(sourceRoot,"scripts/runner-v2/trusted-operator-key.mjs"))));
  const fixtureBase=process.env.RUNNER_TEMP;assert.ok(fixtureBase&&path.win32.isAbsolute(fixtureBase));root=await mkdtemp(path.join(fixtureBase,"signalx-frozen-artifact-"));await assertControlledRoot(root);
  trust=path.join(root,"trust");keyPath=path.join(trust,"operator-public.pem");readerPath=path.join(root,"native-windows-key-reader.exe");await mkdir(trust);await copyFile(prebuiltPath,readerPath);
  provisionerSid=ps("[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",{encoding:"utf8"}).trim();
  publicKey=generateKeyPairSync("rsa",{modulusLength:3072,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}}).publicKey;
  await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();await setReaderAcl();readerHash=`sha256:${EXPECTED_ARTIFACT_SHA}`;readerIdentity=await assertFrozenFile(readerPath);
  console.log(`RUNNER_V2_FROZEN_ARTIFACT_IDENTITY ${JSON.stringify({prebuiltPath,fixturePath:readerPath,size:EXPECTED_ARTIFACT_SIZE,sha256:EXPECTED_ARTIFACT_SHA,mvid:EXPECTED_ARTIFACT_MVID,compilerInvocationCount:0})}`);
});
after(async()=>{if(root&&path.basename(root).startsWith("signalx-frozen-artifact-"))await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:50});});

test("frozen artifact returns valid success framing",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();await setReaderAcl();readerIdentity=await assertFrozenFile(readerPath);const result=await reader()();assert.equal(result.metadata.sameHandle,true);assert.equal(result.key.toString("ascii"),publicKey);result.key.fill(0);});
test("generic malformed request returns exact exit 2 with empty streams",async()=>{const result=await nativeResult(["invalid-request"]);assert.equal(result.code,2);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);});
test("unapproved actual owner returns exact exit 21 with empty streams",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();const result=await nativeResult(["read-fixture",keyPath,trust,runnerSid,"S-1-5-32-544"]);assert.equal(result.code,21);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);});
test("ACL fixture rejection returns exact exit 31 with empty streams",async()=>{const result=await nativeResult(["acl-rights-fixture","key","runner","WriteData"]);assert.equal(result.code,31);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);});
for(const right of ["WriteData","AppendData","WriteExtendedAttributes","WriteAttributes","Delete","ChangePermissions","TakeOwnership","Modify","FullControl"])test(`frozen artifact rejects dangerous runner ${right}`,async()=>assert.equal(await rightsDecision("key","runner",right),31));
test("frozen artifact accepts read-only key rights without ExecuteFile",async()=>assert.equal(await rightsDecision("key","runner","ReadData, ReadExtendedAttributes, ReadAttributes, ReadPermissions, Synchronize"),0));
for(const [name,rights] of [["ReadData","ReadExtendedAttributes, ReadAttributes, ReadPermissions, Synchronize"],["ReadAttributes","ReadData, ReadExtendedAttributes, ReadPermissions, Synchronize"],["ReadPermissions","ReadData, ReadExtendedAttributes, ReadAttributes, Synchronize"],["Synchronize","ReadData, ReadExtendedAttributes, ReadAttributes, ReadPermissions"]])test(`frozen artifact rejects key rights missing ${name}`,async()=>assert.equal(await rightsDecision("key","runner",rights),31));
test("frozen artifact accepts directory traversal rights",async()=>assert.equal(await rightsDecision("directory","runner","ReadData, ReadExtendedAttributes, ReadAttributes, ReadPermissions, ExecuteFile, Synchronize"),0));
test("frozen artifact rejects directory rights missing Traverse",async()=>assert.equal(await rightsDecision("directory","runner","ReadData, ReadExtendedAttributes, ReadAttributes, ReadPermissions, Synchronize"),31));
test("frozen artifact rejects broad-principal write",async()=>assert.equal(await rightsDecision("key","broad","WriteData"),31));
test("direct final key file symlink is reparse and returns exact exit 22",async()=>{
  const directTrust=path.join(root,"direct-key-reparse-trust"),target=path.join(directTrust,"ordinary-target.pem"),linked=path.join(directTrust,"operator-public.pem");await mkdir(directTrust);await writeFile(target,publicKey,"ascii");ps(aclScript(directTrust,true));ps(aclScript(target,false));
  ps(`New-Item -ItemType SymbolicLink -Path '${quotePs(linked)}' -Target '${quotePs(target)}'|Out-Null`);const trustInfo=await lstat(directTrust),targetInfo=await lstat(target),linkInfo=await lstat(linked);assert.equal(trustInfo.isSymbolicLink(),false);assert.equal(targetInfo.isSymbolicLink(),false);assert.equal(linkInfo.isSymbolicLink(),true);
  const result=await nativeResult(["read-fixture",linked,directTrust,runnerSid,provisionerSid]);assert.equal(result.code,22);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);console.log(`RUNNER_V2_DIRECT_KEY_REPARSE ${JSON.stringify({trust:directTrust,target,link:linked,trustReparse:false,targetReparse:false,linkReparse:true,exitCode:result.code,stdoutBytes:0,stderrBytes:0})}`);
});
test("helper file self-reparse is rejected before execution",async()=>{const bin=path.join(root,"self-reparse-bin"),target=path.join(bin,"target.exe"),link=path.join(bin,"reader-link.exe");await mkdir(bin);await copyFile(prebuiltPath,target);ps(aclScript(target,false,{runnerRights:"ReadAndExecute"}));ps(`New-Item -ItemType SymbolicLink -Path '${quotePs(link)}' -Target '${quotePs(target)}'|Out-Null`);await assert.rejects(reader({helperPath:link,expectedHelperHash:readerHash})(),/HELPER_ACL_REJECTED/);});
test("immediate controlled-root junction is rejected",async()=>{const target=path.join(root,"junction-target"),junction=path.join(root,"junction-root");await mkdir(target);const key=path.join(target,"operator-public.pem");await writeFile(key,publicKey,"ascii");ps(aclScript(target,true));ps(aclScript(key,false));ps(`New-Item -ItemType Junction -Path '${quotePs(junction)}' -Target '${quotePs(target)}'|Out-Null`);const result=await nativeResult(["read-fixture",path.join(junction,"operator-public.pem"),junction,runnerSid,provisionerSid]);assert.equal(result.code,22);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);});
test("higher nested junction is rejected",async()=>{const target=path.join(root,"outer-target"),nested=path.join(target,"nested","trust"),junction=path.join(root,"outer-junction");await mkdir(nested,{recursive:true});const key=path.join(nested,"operator-public.pem");await writeFile(key,publicKey,"ascii");ps(aclScript(nested,true));ps(aclScript(key,false));ps(`New-Item -ItemType Junction -Path '${quotePs(junction)}' -Target '${quotePs(target)}'|Out-Null`);const linkedTrust=path.join(junction,"nested","trust"),result=await nativeResult(["read-fixture",path.join(linkedTrust,"operator-public.pem"),linkedTrust,runnerSid,provisionerSid]);assert.equal(result.code,22);assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);});
test("actual read-only key succeeds without ExecuteFile",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();const result=await nativeResult(["read-fixture",keyPath,trust,runnerSid,provisionerSid]);assert.equal(result.code,0);assert.ok(result.stdout.length>16);assert.equal(result.stderr.length,0);});
test("actual key ACL inheritance and dangerous writes fail closed",async()=>{for(const keyOptions of [{inheritance:true},{broadWrite:true},{runnerWrite:true}]){await writeFile(keyPath,publicKey,"ascii");await setKeyAcl({key:keyOptions});const result=await nativeResult(["read-fixture",keyPath,trust,runnerSid,provisionerSid]);assert.notEqual(result.code,0);}await setKeyAcl();});
test("trust directory requires traversal",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl({trust:{runnerRights:"Read"},key:{}});const result=await nativeResult(["read-fixture",keyPath,trust,runnerSid,provisionerSid]);assert.equal(result.code,2);await setKeyAcl();});
test("Node helper inspection requires ExecuteFile",async()=>{await setReaderAcl({runnerRights:"Read"});await assert.rejects(reader()(),/HELPER_RUNNER_ACL_REJECTED/);await setReaderAcl();readerIdentity=await assertFrozenFile(readerPath);});
test("helper ancestor junction and missing helper fail closed",async()=>{const target=path.join(root,"helper-target"),nested=path.join(target,"nested"),junction=path.join(root,"helper-junction");await mkdir(nested,{recursive:true});const copy=path.join(nested,"reader.exe");await copyFile(prebuiltPath,copy);ps(aclScript(copy,false,{runnerRights:"ReadAndExecute"}));ps(`New-Item -ItemType Junction -Path '${quotePs(junction)}' -Target '${quotePs(target)}'|Out-Null`);await assert.rejects(reader({helperPath:path.join(junction,"nested","reader.exe"),expectedHelperHash:readerHash})(),/HELPER_(ACL|IDENTITY|REPARSE)_REJECTED/);await assert.rejects(reader({helperPath:path.join(root,"missing.exe")})());});
test("helper replacement between hash and launch fails closed",async()=>{const original=await readFile(readerPath);let replaced=false;const replacingSpawn=(file,args,options)=>{if(!replaced){execFileSync(POWERSHELL,["-NoProfile","-NonInteractive","-Command",`[IO.File]::WriteAllBytes('${quotePs(readerPath)}',[byte[]](1,2,3,4))`],{windowsHide:true});replaced=true;}return spawn(file,args,options);};try{await assert.rejects(reader({spawnImpl:replacingSpawn})(),/KEY_READER_(FAILED|UNAVAILABLE)|HELPER_REPLACED/);}finally{await restoreReader(original);}assert.equal(replaced,true);});
test("malformed framed protocol fails closed",async()=>{const fake=()=>{const handlers={},stream={on(name,cb){handlers[name]=cb;return stream;}};queueMicrotask(()=>{handlers.data?.(Buffer.from("not-a-frame"));handlers.close?.(0);});return{stdout:stream,stderr:{on(){return this;}},on(name,cb){handlers[name]=cb;return this;},kill(){}};};await assert.rejects(reader({spawnImpl:fake})(),/PROTOCOL/);});
test("fingerprint mismatch zeroizes key buffer",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();const result=await reader()();await assert.rejects(loadTrustedKeyReadBinding({keyReadProvider:async()=>result,approvedFingerprintProvider:async()=>"sha256:"+"0".repeat(64)}));assert.ok(result.key.every(byte=>byte===0));});
test("valid key and separate fingerprint bind",async()=>{await writeFile(keyPath,publicKey,"ascii");await setKeyAcl();const binding=await loadTrustedKeyReadBinding({keyReadProvider:reader(),approvedFingerprintProvider:async()=>operatorPublicKeyFingerprint(publicKey)});assert.equal(binding.approvedOperatorKeyFingerprint,operatorPublicKeyFingerprint(publicKey));});
test("frozen artifact remains byte-identical after qualification",async()=>{await assertFrozenFile(prebuiltPath);await assertFrozenFile(readerPath,{stable:true});console.log(`RUNNER_V2_COMPILER_INVOCATION_COUNT 0`);});
test.skip("elevated actual unapproved owner SID requires approved privileged environment gate",()=>{});
test.skip("approved SYSTEM owner requires a separately privileged fixture token",()=>{});
