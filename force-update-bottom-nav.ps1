param([string]$ProjectRoot = ".")

$targets = @(
  @{ Path = "app/dashboard/page.tsx";    Active = "/dashboard" },
  @{ Path = "app/today-market/page.tsx"; Active = "/today-market" },
  @{ Path = "app/ranking/page.tsx";      Active = "/ranking" },
  @{ Path = "app/scan-mobile/page.tsx";  Active = "/scan-mobile" },
  @{ Path = "app/favorites/page.tsx";    Active = "/favorites" },
  @{ Path = "app/alerts/page.tsx";       Active = "" },
  @{ Path = "app/learning/page.tsx";     Active = "" }
)

function Get-NavLines([string]$active) {
  $items = @(
    @{ href="/dashboard";    icon="🏠"; label="ホーム" },
    @{ href="/today-market"; icon="🤖"; label="市場" },
    @{ href="/ranking";      icon="🏆"; label="ランキング" },
    @{ href="/scan-mobile";  icon="🔍"; label="スキャン" },
    @{ href="/favorites";    icon="⭐"; label="お気に入り" }
  )

  return (($items | ForEach-Object {
    $activeText = if ($_.href -eq $active) { " active" } else { "" }
    "        <Nav href=`"$($_.href)`" icon=`"$($_.icon)`" label=`"$($_.label)`"$activeText />"
  }) -join "`r`n")
}

$changed = 0

foreach ($target in $targets) {
  $file = Join-Path $ProjectRoot $target.Path

  if (-not (Test-Path $file)) {
    Write-Host "見つかりません: $($target.Path)" -ForegroundColor Red
    continue
  }

  $content = Get-Content -Raw -Encoding UTF8 $file
  $navLines = Get-NavLines $target.Active

  # BottomNav関数内の5つのNav行だけを確実に差し替える
  $pattern = '(?s)(function\s+BottomNav\s*\(\s*\)\s*\{.*?<div[^>]*grid-cols-5[^>]*>\s*)(?:<Nav\b.*?/>\s*){5}(\s*</div>)'
  $replacement = '${1}' + "`r`n" + $navLines + "`r`n" + '${2}'

  $newContent = [regex]::Replace($content, $pattern, $replacement, 1)

  if ($newContent -eq $content) {
    Write-Host "変更できませんでした: $($target.Path)" -ForegroundColor Yellow
    continue
  }

  Set-Content -Path $file -Value $newContent -Encoding UTF8
  Write-Host "変更完了: $($target.Path)" -ForegroundColor Green
  $changed++
}

Write-Host ""
Write-Host "$changed / $($targets.Count) ファイルを変更しました。" -ForegroundColor Cyan
Write-Host ""
Write-Host "現在のナビを確認します:" -ForegroundColor Cyan

foreach ($target in $targets) {
  $file = Join-Path $ProjectRoot $target.Path
  if (Test-Path $file) {
    Write-Host "`n[$($target.Path)]" -ForegroundColor White
    Select-String -Path $file -Pattern '<Nav href=' | Select-Object -Last 5 | ForEach-Object {
      Write-Host $_.Line.Trim()
    }
  }
}
