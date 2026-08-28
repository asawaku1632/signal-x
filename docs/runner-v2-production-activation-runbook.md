# runner-v2 Production forward-rotation runbook

This document is an execution checklist, not an activation command. Never source it or paste secrets into a shell. A fresh process and an approved, signed activation manifest are required.

| Step | Success condition | Failure action / retry | Credential HOLD | Downstream prohibition |
|---|---|---|---|---|
| PRECHECK | Fixed Supabase ref, role, Vercel project ID, environment and initial state match; no operation attempted | STOP; fix metadata only; pre-rotation retry allowed | No | Everything |
| OPERATOR AUTHORIZE | `ACTIVATE` manifest signature, nonce, expiry, project/ref/role/environment/state all verify | STOP; do not weaken checks; new signed manifest required | No | Secret generation and all writes |
| GENERATE SECRET | One 256-bit CSPRNG value exists only as a process Buffer | CLEANUP and STOP before rotation; one fresh generation allowed in a fresh run | Yes after creation | Rotation until generation succeeds |
| ROTATE | Fixed role reports success exactly once | Enter HOLD; no automatic retry or second rotation | Yes | Direct/Pooler/Vercel until success |
| DIRECT AUTH | One TLS-verified connection authenticates fixed Direct username within timeout | Enter HOLD. Do **not** destroy the new password and do not rotate again | Yes | Pooler and Vercel |
| DIRECT READ ONLY IDENTITY | Exact role/session/database identity in `BEGIN READ ONLY` | HOLD; no retry in this process | Yes | Pooler and Vercel |
| DIRECT ROLLBACK | Explicit `ROLLBACK` succeeds | HOLD; treat transaction/session as unsafe | Yes | Pooler and Vercel |
| POOLER AUTH | Same password authenticates fixed tenant-qualified Pooler username over TLS | HOLD; no automatic retry. Direct PASS + Pooler FAIL: inspect Supavisor logs using approved read-only process | Yes | Vercel |
| POOLER READ ONLY IDENTITY | Exact role/session/database identity in read-only transaction | HOLD | Yes | Vercel |
| POOLER ROLLBACK | Explicit `ROLLBACK` succeeds | HOLD; no retry in this process | Yes | Vercel |
| VERCEL REGISTER | Fixed Sensitive variable is created through stdin for the fixed project ID/environment | HOLD; never fall back to `DATABASE_URL`; operator decides recovery | Yes | Metadata verification cannot claim PASS |
| VERIFY ENV METADATA | Name, project ID, production environment and Sensitive type match without reading value | HOLD; no redeploy | Yes | CLEANUP as success prohibited; use failure cleanup only after operator decision |
| CLEANUP | All mutable secret Buffers are zeroed and sessions/processes closed | STOP and record safe classification only | No after confirmed zeroization | Further operations in this process |
| STOP | Runner is DONE and no deploy/redeploy occurred | Open a new authorized run for any future action | No | All operations |
| VERCEL RECOVERY HOLD | Record only PRESENT_EXPECTED_METADATA, ABSENT, MISMATCH, or UNKNOWN for the same run/attempt | No write or automatic retry; signed recovery required | Yes, maximum 15 minutes | Rotation, auth, registration, deploy |
| ABORT | Secret is zeroed and state is ABORTED, not DONE | Terminal; a new run and authorization are required | No | All operations |

## Failure and recovery invariants

- Attempt limits are one for rotation, Direct connection, Pooler connection, and Vercel registration; automatic retry is zero.
- HOLD accepts only authenticated RESUME for a resumable operator hold or CLEANUP. Failure HOLD is not automatically resumable.
- After rotation, Direct failure retains the new password in process memory. Operator must establish the recovery decision before cleanup.
- Direct SUCCESS plus Pooler FAIL retains the same password and stops before Vercel. Review Supavisor logs through a separately approved read-only workflow.
- Never print raw errors, SQL containing a password, connection strings, verifier material, tokens, stdout, or stderr.
- Never use a temporary file, clipboard, `.env`, command argument, shell expansion, or `DATABASE_URL` as secret transport.
- A registration failure is treated as uncertain. HOLD retains the same-process secret and binds recovery to the original run ID and registration attempt ID.
- PRESENT_EXPECTED_METADATA may reach CLEANUP only with a fresh signed recovery authorization (maximum five minutes). It never causes another registration.
- ABSENT, MISMATCH, and UNKNOWN cannot complete the run. They require ABORT or a separately approved new forward-recovery run.
- Recovery HOLD expires after 15 minutes: the runner zeroizes the secret and enters ABORTED without any DB, Vercel, or deployment operation.
- Environment registration does not deploy. DONE does not update an existing Production Deployment; deploy/redeploy remains a separate approval and window.

## Trusted operator public-key provisioning (not an activation step)

1. An approved Administrator creates `%ProgramData%\SignalX\runner-v2\trust` outside every repository.
2. Disable ACL inheritance. Grant the runner only Read/Read Attributes/Read Permissions (and parent Traverse); grant SYSTEM and approved provisioning identities Full Control. Remove Everyone and unexpected writable principals.
3. Create a staging file in an Administrator-only staging location outside the trust tree. Never place a private key on the runner host or in the trust directory/parent tree.
4. Validate one BOM-free PEM/SPKI PUBLIC KEY object, maximum 16 KiB, RSA 3072 bits or stronger.
5. Calculate SHA-256 over canonical DER/SPKI. A separate Recovery/Activation Approver records and approves the complete `sha256:<lowercase hex>` fingerprint through a channel independent of the key file.
6. Atomically replace `operator-public.pem` as an approved Administrator. Key replacement always requires a new fingerprint approval.
7. Reapply and verify owner/DACL, inheritance disabled, no reparse points, and fixed file identity.
8. Run the read-only provider validation as the runner account. ACL inspection unavailable, path/owner/identity mismatch, or fingerprint mismatch is a hard NO-GO.

### Windows-only ACL inspector acceptance specification

The native inspector is a required production dependency, not an optional warning. Qualify it on a disposable Windows host with fixture keys only; never use the Production key during qualification.

- Resolve ProgramData through the Windows Known Folder API and reject UNC or reparse-backed results.
- Inspect every path component with handle-based Windows APIs and return owner SID, protected-DACL/inheritance state, normalized ACEs, reparse attributes, volume serial number, and file ID.
- Demonstrate PASS for exactly the approved owner and DACL, then demonstrate rejection of inheritance, runner/broad-principal write access, unexpected writable principals, wrong owner, symlink/junction/reparse components, missing identity fields, and path replacement during a held open handle.
- Compare the opened handle identity with both pre-open and post-read path identities. If the platform cannot provide any required field, report inspection unavailable and fail closed.
- Execute the integration test as the actual runner account and retain only safe classifications; key bytes, ACL raw dumps, and security tokens must not enter stdout/stderr/events.

The reopen-based native ACL inspector remains compatibility/test-only and cannot construct a Production key provider. Production key binding uses only the trusted native reader: that helper owns the fixed-path open, validates owner/DACL/reparse/final-path/volume/file-ID metadata on the same key handle, performs the bounded read, and repeats security and identity checks before returning bytes. The helper executable itself also requires a fixed OS-known-folder path, owner/DACL/reparse verification, and approved binary integrity before deployment.

## Trusted key-read helper provisioning (separate change record)

The trusted key-read helper now owns the fixed-path open, handle-based security decision, bounded read, and post-read verification. Production never compiles C# source and Node never directly opens the Production public-key file.

1. Build the reviewed helper source in an approved isolated build environment for Windows x64 and the approved .NET Framework runtime.
2. Record compiler/runtime inputs and produce the prebuilt `native-windows-key-reader.exe`; do not build on the activation host.
3. Calculate SHA-256 over the complete binary and record `sha256:<64 lowercase hex>`.
4. Obtain independent source/binary review and hash approval. This record is separate from public-key provisioning and fingerprint approval.
5. Create `%ProgramData%\SignalX\runner-v2\bin` as an approved Administrator.
6. Disable inheritance on the bin directory and helper file.
7. Grant the runner Read/Read Attributes/Read Permissions/Execute only; grant SYSTEM and approved Administrators/provisioners Full Control. Reject broad or unexpected writable principals.
8. Set owner to SYSTEM or the approved Administrator/provisioner.
9. Atomically place the prebuilt helper at `%ProgramData%\SignalX\runner-v2\bin\native-windows-key-reader.exe` without placing source, keys, or credentials beside it.
10. Revalidate exact path, regular-file type, owner, protected DACL, reparse-free components, size, file ID, and SHA-256.
11. Validate read/execute-only access using the actual runner identity; the runner must be unable to write, delete, replace, change permissions, or take ownership.
12. Bind the independently approved exact hash through the Production expected-helper-hash provider. Missing, malformed, uppercase, or mismatched hashes are a hard NO-GO.

`CreateProcess` resolves an executable path rather than launching an already verified file handle. Pre/post identity and hash checks plus a non-writable directory/file ACL mitigate replacement by the runner, but do not prevent an approved Administrator from racing launch. Provisioning and activation windows must prohibit concurrent helper maintenance.

### Trusted reader IPC contract

- The child process's redirected stdout handle is a dedicated binary IPC pipe; it is never inherited by or attached to normal console output.
- The parent captures that pipe in memory and never forwards the key frame to process stdout, stderr, events, or logs.
- The frame has a fixed magic value, bounded metadata and key lengths, exact total-length validation, JSON metadata validation, and rejection of truncation or trailing bytes.
- Child stderr and raw failures are discarded and normalized to safe classifications. Raw errors, ACL dumps, key material, and verifier material are never logged.
