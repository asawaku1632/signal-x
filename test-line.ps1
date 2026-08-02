Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BaseUrl = "https://signal-x-ppjg.vercel.app"

function Invoke-ApiOnce {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("GET", "POST")]
        [string]$Method,

        [Parameter(Mandatory)]
        [string]$Uri,

        [string]$Authorization
    )

    $responseFile = New-TemporaryFile

    try {
        $arguments = @(
            "-6",
            "--silent",
            "--show-error",
            "--request", $Method,
            "--output", $responseFile.FullName,
            "--write-out", "%{http_code}",
            "--connect-timeout", "10",
            "--max-time", "300"
        )

        if ($Authorization) {
            $arguments += @("--header", "Authorization: Bearer $Authorization")
        }

        $arguments += $Uri
        $status = & curl.exe @arguments

        if ($LASTEXITCODE -ne 0) {
            return 0
        }

        return [int]$status
    }
    finally {
        Remove-Item -LiteralPath $responseFile.FullName -Force -ErrorAction SilentlyContinue
    }
}

$scanStatus = Invoke-ApiOnce `
    -Method GET `
    -Uri "$BaseUrl/api/scan"

Write-Host "/api/scan: HTTP $scanStatus"

if ($scanStatus -ne 200) {
    exit 1
}

$rankingStatus = Invoke-ApiOnce `
    -Method GET `
    -Uri "$BaseUrl/api/ranking"

Write-Host "/api/ranking: HTTP $rankingStatus"

if ($rankingStatus -ne 200) {
    exit 1
}

$envPath = Join-Path $PSScriptRoot ".env.local"
$envText = Get-Content -LiteralPath $envPath -Raw
$secretMatch = [regex]::Match(
    $envText,
    "(?m)^\s*CRON_SECRET\s*=\s*(?:`"([^`"]*)`"|'([^']*)'|([^\r\n#]*))"
)

if (-not $secretMatch.Success) {
    throw "CRON_SECRET was not found in .env.local"
}

if ($secretMatch.Groups[1].Success) {
    $cronSecret = $secretMatch.Groups[1].Value
}
elseif ($secretMatch.Groups[2].Success) {
    $cronSecret = $secretMatch.Groups[2].Value
}
else {
    $cronSecret = $secretMatch.Groups[3].Value.Trim()
}

try {
    $lineStatus = Invoke-ApiOnce `
        -Method POST `
        -Uri "$BaseUrl/api/test/line" `
        -Authorization $cronSecret

    Write-Host "/api/test/line: HTTP $lineStatus"
}
finally {
    Remove-Variable cronSecret -ErrorAction SilentlyContinue
}
