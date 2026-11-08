# Build a Google Play upload bundle using the ORIGINAL private upload key locally.
# NEVER upload the keystore or passwords to GitHub, ChatGPT, or a file-sharing service.
param(
    [string]$KeystorePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$project = $PSScriptRoot
$manifestPath = Join-Path $project "twa-manifest.json"
$gradlePath = Join-Path $project "app/build.gradle"
if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $gradlePath)) {
    throw "SIGNALX android-twa project was not found."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$gradle = Get-Content -LiteralPath $gradlePath -Raw -Encoding UTF8
if ($manifest.packageId -ne "com.signalx.app" -or $manifest.appVersion -ne "1.0.2" -or
    [int]$manifest.appVersionCode -ne 5 -or
    $gradle -notmatch 'versionCode\s+5\b' -or
    $gradle -notmatch 'versionName\s+"1\.0\.2"') {
    throw "The Android project is not the expected SIGNALX 1.0.2 (versionCode 5). Update from main first."
}

if (-not $KeystorePath) {
    $KeystorePath = Join-Path $project $manifest.signingKey.path
}
if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    throw ("Original Play UPLOAD keystore not found: " + $KeystorePath +
        ". Use the PC where you created the original app and pass -KeystorePath. DO NOT generate a new key.")
}

$keyFile = (Resolve-Path -LiteralPath $KeystorePath).Path
if (-not (Get-Command "npx.cmd" -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm was not found. Install Node.js on this PC first."
}

Write-Host ""
Write-Host "SIGNALX 1.0.2 / versionCode 5 - Google Play INTERNAL TEST bundle" -ForegroundColor Cyan
Write-Host "Original upload keystore: $keyFile"
Write-Host "Passwords are requested locally by Bubblewrap. Do not share them."
Write-Host ""
Push-Location $project
try {
    & npx.cmd --yes "@bubblewrap/cli@1.27.0" build "--signingKeyPath=$keyFile" "--signingKeyAlias=$($manifest.signingKey.alias)"
    if ($LASTEXITCODE -ne 0) {
        throw "Signed bundle build failed. Check Bubblewrap output above. No Google Play upload was performed."
    }
    $bundle = Join-Path $project "app-release-bundle.aab"
    if (-not (Test-Path -LiteralPath $bundle -PathType Leaf)) {
        throw "Bubblewrap did not create app-release-bundle.aab. No Google Play upload was performed."
    }
    $file = Get-Item -LiteralPath $bundle
    if ($file.Length -le 0) {
        throw "Generated app bundle is empty."
    }
    Write-Host ""
    Write-Host "SUCCESS - Signed AAB ready for manual Play Console INTERNAL TEST upload:" -ForegroundColor Green
    Write-Host $file.FullName
    Write-Host ("SHA-256: " + (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash)
    Write-Host "Verify that Play Console's highest existing versionCode is lower than 5."
    Write-Host "The bundle has NOT been uploaded or released automatically."
} finally {
    Pop-Location
}
