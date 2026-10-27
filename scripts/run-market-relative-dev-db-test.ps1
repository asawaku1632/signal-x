# Manual only. Run locally in PowerShell from the repository root.
$ErrorActionPreference = "Stop"
$project = "jdtqwryiyxeuoraecorw"
$env:SIGNALX_RESEARCH_DEV_PROJECT_ID = $project
$env:SIGNALX_RESEARCH_DEV_DB_TEST = "I_UNDERSTAND_DEV_ONLY"
$hostName = "aws-0-ap-northeast-1.pooler.supabase.com"
$secret = Read-Host "Enter development database password (hidden)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $encoded = [Uri]::EscapeDataString($password)
  $env:SIGNALX_RESEARCH_DEV_DATABASE_URL = "postgresql://postgres.$project" + ":$encoded@$hostName" + ":5432/postgres?sslmode=verify-full"
  Write-Host "Running development-only transactional integration test..."
  node scripts/check-market-relative-dev-db-integration.mjs
  if ($LASTEXITCODE -ne 0) { throw "Integration test failed. Exit code: $LASTEXITCODE" }
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Item Env:SIGNALX_RESEARCH_DEV_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SIGNALX_RESEARCH_DEV_PROJECT_ID -ErrorAction SilentlyContinue
  Remove-Item Env:SIGNALX_RESEARCH_DEV_DB_TEST -ErrorAction SilentlyContinue
  $password = $null
  $encoded = $null
  $secret = $null
}
