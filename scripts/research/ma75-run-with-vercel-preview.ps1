# Research-only: run already-authorized J-Quants daily read via local Vercel Preview env.
# No secret is printed or saved to .env, no billing/plan/deployment/production changes.
[CmdletBinding()]
param(
  [string]$From = '2026-05-01',
  [string]$To = '2026-10-30',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$expectedProjectId = 'prj_aVyZPjouc0Mp8KU6f7bLHRDC2tJE'
$expectedOrgId = 'team_gZA72LpzV6bPcilscBRoLQW8'
$expectedBranch = 'research/ma75-breakout-retest-shadow-20261031'
$nodeScript = 'scripts/research/ma75-jquants-bulk-retrospective.mjs'
$childScript = 'scripts/research/ma75-jquants-vercel-preview-entry.mjs'
if (-not (Test-Path $nodeScript -PathType Leaf)) {
  throw 'Run from the signal-x repository root with the latest PR #297 checkout.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required. Do not run with an unverified Node installation.'
}
$arguments = @($nodeScript, "--from=$From", "--to=$To")
if (-not $Execute) {
  & node @arguments
  if ($LASTEXITCODE -ne 0) { throw 'J-Quants retrospective DRY RUN failed.' }
  return
}
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  throw 'Vercel CLI is unavailable. Install it privately, sign in, and link the verified project first.'
}
if (-not (Test-Path '.vercel/project.json' -PathType Leaf)) {
  throw 'Link this local repo to Vercel project signal-x under team signalx-runner-v2-trial2 using vercel link, then re-run.'
}
$link = Get-Content '.vercel/project.json' -Raw | ConvertFrom-Json
if (($link.projectId -ne $expectedProjectId) -or ($link.orgId -ne $expectedOrgId)) {
  throw 'Refusing to load secrets: local Vercel project/team does not match the expected signal-x Preview.'
}
if (-not (Test-Path $childScript -PathType Leaf)) {
  throw 'Missing the Windows-safe Vercel Preview child script. Fetch the latest PR #297 branch first.'
}
# Vercel CLI 59.x on Windows can consume --from/--to meant for Node.
# Keep every date/control flag out of its command line. The child receives
# them only through temporary process environment variables, never .env.
$setting = @{
  'SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY' = 'YES'
  'SIGNALX_MA75_LOCAL_BULK_EXECUTE' = 'YES'
  'SIGNALX_MA75_LOCAL_FROM' = $From
  'SIGNALX_MA75_LOCAL_TO' = $To
}
$oldSettings = @{}
foreach ($name in $setting.Keys) {
  $oldSettings[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
  foreach ($name in $setting.Keys) {
    [Environment]::SetEnvironmentVariable($name, $setting[$name], 'Process')
  }
  # No Node flags appear after '--': workaround for Vercel CLI 59.x
  # parsing --from as a Vercel flag before launching the child.
  & vercel env run -e preview --git-branch $expectedBranch -- node $childScript
  if ($LASTEXITCODE -ne 0) {
    throw 'Historical read was blocked. Do not paste credentials; share only the redacted error category.'
  }
} finally {
  foreach ($name in $oldSettings.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldSettings[$name], 'Process')
  }
}
