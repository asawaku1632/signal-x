param(
  [string]$ProjectRoot = "."
)

$files = @(
  "app/dashboard/page.tsx",
  "app/scan-mobile/page.tsx",
  "app/today-market/page.tsx",
  "app/ranking/page.tsx",
  "app/favorites/page.tsx",
  "app/alerts/page.tsx",
  "app/learning/page.tsx"
)

$updated = 0

foreach ($relativePath in $files) {
  $fullPath = Join-Path $ProjectRoot $relativePath

  if (-not (Test-Path $fullPath)) {
    Write-Host "見つからないためスキップ: $relativePath" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content -Raw -Encoding UTF8 $fullPath

  $fixed = [regex]::Replace(
    $content,
    'className=\{\s*ext-center text-xs font-bold\s*\}',
    'className={active ? "text-center text-xs font-bold text-blue-600" : "text-center text-xs font-bold text-slate-500"}'
  )

  if ($fixed -eq $content) {
    Write-Host "修正箇所なし: $relativePath" -ForegroundColor Yellow
    continue
  }

  Set-Content -Path $fullPath -Value $fixed -Encoding UTF8
  Write-Host "修正完了: $relativePath" -ForegroundColor Green
  $updated++
}

Write-Host ""
Write-Host "$updated ファイルを修正しました。" -ForegroundColor Cyan
Write-Host "次に npm run build を実行してください。" -ForegroundColor Cyan
