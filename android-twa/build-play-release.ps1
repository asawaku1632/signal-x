# Build a Google Play upload bundle using the ORIGINAL private upload key locally.
# NEVER upload the keystore or passwords to GitHub, ChatGPT, or a file-sharing service.
param(
    [string]$KeystorePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$project = $PSScriptRoot
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $project "..")).Path
# A clean standalone clone is required. The user's working SIGNALX repo may have
# hundreds of unrelated uncommitted files that must never be touched by a release.
if (-not (Get-Command "git.exe" -ErrorAction SilentlyContinue)) {
    throw "Git is required. Make a separate clean clone of SIGNALX before building."
}
$dirtyFiles = @(& git.exe -C $repositoryRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0 -or $dirtyFiles.Count -gt 0) {
    throw "This working tree contains local changes or is not a Git clone. Create a clean separate release clone. Nothing was changed."
}
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
if (-not (Get-Command "keytool.exe" -ErrorAction SilentlyContinue)) {
    throw "Java JDK keytool is missing. Install JDK 17 first."
}

# Bubblewrap build would otherwise prompt to regenerate this custom Android app:
# the checked-in manifest-checksum.txt predates the version/delegation edits.
# A regeneration would DISCARD the manual Android notification fixes.
# Only refresh the checksum in the clean disposable clone, never in the original.
$checksumPath = Join-Path $project "manifest-checksum.txt"
$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA1).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($checksumPath, $manifestHash, [System.Text.Encoding]::ASCII)

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
    # Check the final AAB's actual signing certificate, not just its filename.
    $expectedUploadFingerprint = "17:66:A9:A1:58:B0:FF:9A:1E:A0:AA:FE:22:12:0A:E9:60:DD:BF:4F:81:B4:0B:A4:A2:D9:26:93:E3:53:9D:79"
    $certOutput = (& keytool.exe -printcert -jarfile $bundle 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $certOutput -notmatch [regex]::Escape($expectedUploadFingerprint)) {
        throw "The AAB signer does not match the Google Play UPLOAD key. Do NOT upload this bundle."
    }

    Write-Host ""
    Write-Host "SIGNED CERTIFICATE VERIFIED - Google Play upload SHA-256 matches." -ForegroundColor Green
    Write-Host "SUCCESS - Signed AAB ready for manual Play Console INTERNAL TEST upload:" -ForegroundColor Green
    Write-Host $file.FullName
    Write-Host ("SHA-256: " + (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash)
    Write-Host "Verify that Play Console's highest existing versionCode is lower than 5."
    Write-Host "The bundle has NOT been uploaded or released automatically."
} finally {
    Pop-Location
}
