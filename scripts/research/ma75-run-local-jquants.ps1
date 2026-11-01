# Local J-Quants V2 research, explicit opt-in only.
# Reads licensed daily bars, prints progress, saves under ignored research-private.
# No Vercel CLI, env pull, .env writes, DB, deployment, orders or notifications.
[CmdletBinding()]
param(
  [string]$From = '2026-05-01',
  [string]$To = '2026-10-30',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$scriptPath = '.\scripts\research\ma75-jquants-bulk-retrospective.mjs'
if (-not (Test-Path $scriptPath -PathType Leaf)) {
  throw 'Run from the signal-x repository root.'
}
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  throw 'Node.js is unavailable.'
}
$nodeArgs = @($scriptPath, "--from=$From", "--to=$To")
if (-not $Execute) {
  & node @nodeArgs
  if ($LASTEXITCODE -ne 0) { throw 'MA75 local dry-run failed.' }
  return
}
$priorKey = [Environment]::GetEnvironmentVariable('JQUANTS_API_KEY','Process')
$priorConsent = [Environment]::GetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY','Process')
$secureKey = $null
$keyPtr = [IntPtr]::Zero
try {
  $secureKey = Read-Host 'J-Quants V2 API key (hidden)' -AsSecureString
  $keyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPtr)
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw 'EMPTY_JQUANTS_V2_API_KEY'
  }
  [Environment]::SetEnvironmentVariable('JQUANTS_API_KEY',$plainKey,'Process')
  $plainKey = $null
  [Environment]::SetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY','YES','Process')
  # Bulk script logs verified date and counts after every captured day.
  # Existing daily files are integrity-checked before reuse and never overwritten.
  & node @nodeArgs '--execute'
  if ($LASTEXITCODE -ne 0) {
    throw 'MA75 historical capture was blocked; saved valid date files are preserved for retry.'
  }
} finally {
  [Environment]::SetEnvironmentVariable('JQUANTS_API_KEY',$priorKey,'Process')
  [Environment]::SetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY',$priorConsent,'Process')
  if ($keyPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPtr)
  }
  $secureKey = $null
}
