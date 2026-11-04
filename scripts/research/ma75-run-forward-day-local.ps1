# Research-only manually approved daily J-Quants V2 source capture.
# -Execute is required for any network use. No auto schedule or production writes.
[CmdletBinding()]
param(
  [string]$Date = '2026-11-02',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$scriptPath = '.\scripts\research\ma75-forward-local-one-day.mjs'
if (-not (Test-Path $scriptPath -PathType Leaf)) {
  throw 'Run this command from the signal-x research worktree root.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required.'
}
$dayArgument = "--date=$Date"
$planText = & node $scriptPath $dayArgument
if ($LASTEXITCODE -ne 0) {
  throw 'The research-only forward date plan is invalid.'
}
$plan = $planText | ConvertFrom-Json
if (-not $Execute) {
  $planText
  return
}
if ($plan.status -eq 'DRY_RUN_SESSION_NOT_YET_PUBLISHED') {
  throw 'The requested session has not yet passed the conservative J-Quants release floor (16:30 JST).'
}
if ($plan.alreadyStored -eq $true) {
  throw 'Original forward date capture already exists. It must never be overwritten.'
}
$oldKey = [Environment]::GetEnvironmentVariable('JQUANTS_API_KEY','Process')
$oldConsent = [Environment]::GetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY','Process')
$ptr = [IntPtr]::Zero
$secret = $null
$keyText = $null
try {
  $secret = Read-Host 'Existing J-Quants V2 API key (hidden)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $keyText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ([string]::IsNullOrWhiteSpace($keyText)) {
    throw 'An existing private API key is required.'
  }
  [Environment]::SetEnvironmentVariable('JQUANTS_API_KEY',$keyText,'Process')
  $keyText = $null
  [Environment]::SetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY','YES','Process')
  & node $scriptPath $dayArgument '--execute'
  if ($LASTEXITCODE -ne 0) {
    throw 'The original one-day forward capture was blocked or failed. Existing private data were not replaced.'
  }
} finally {
  [Environment]::SetEnvironmentVariable('JQUANTS_API_KEY',$oldKey,'Process')
  [Environment]::SetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY',$oldConsent,'Process')
  if ($ptr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  $secret = $null
  $keyText = $null
}
