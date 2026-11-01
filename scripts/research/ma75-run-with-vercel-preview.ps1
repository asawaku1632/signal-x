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
$oldConsent = [Environment]::GetEnvironmentVariable('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY', 'Process')
try {
  $env:SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY = 'YES'
  # Vercel CLI passes Preview env vars to Node in memory. Never print them.
  & vercel env run -e preview --git-branch $expectedBranch -- node @arguments --execute
  if ($LASTEXITCODE -ne 0) {
    throw 'Historical source collection blocked. Inspect local research-private files, do not paste keys.'
  }
} finally {
  if ($null -eq $oldConsent) {
    Remove-Item Env:SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY -ErrorAction SilentlyContinue
  } else {
    $env:SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY = $oldConsent
  }
}
