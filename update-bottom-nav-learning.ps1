$ErrorActionPreference = "Stop"

$targets = @(
    "app/dashboard/page.tsx",
    "app/today-market/page.tsx",
    "app/ranking/page.tsx",
    "app/scan-mobile/page.tsx",
    "app/favorites/page.tsx",
    "app/alerts/page.tsx",
    "app/learning/page.tsx"
)

$navByPage = @{
    "app/dashboard/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" active />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@

    "app/today-market/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" active />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@

    "app/ranking/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" active />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@

    "app/learning/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" active />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@

    "app/favorites/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" active />
'@

    "app/scan-mobile/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@

    "app/alerts/page.tsx" = @'
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
'@
}

$pattern = '(?ms)(function\s+BottomNav\s*\(\s*\)\s*\{.*?return\s*\(\s*<nav\b.*?>.*?)(?:\s*<Nav\b[^>]*/>\s*){5}(.*?</nav>\s*\)\s*;\s*\})'

foreach ($file in $targets) {
    if (-not (Test-Path $file)) {
        Write-Warning "見つからないためスキップ: $file"
        continue
    }

    $content = Get-Content -Path $file -Raw -Encoding UTF8
    $replacementNav = $navByPage[$file]

    $updated = [regex]::Replace(
        $content,
        $pattern,
        {
            param($match)
            $match.Groups[1].Value + "`r`n" + $replacementNav.TrimEnd() + "`r`n    " + $match.Groups[2].Value
        },
        1
    )

    if ($updated -eq $content) {
        Write-Warning "BottomNavを更新できませんでした: $file"
        continue
    }

    Set-Content -Path $file -Value $updated -Encoding UTF8
    Write-Host "更新完了: $file" -ForegroundColor Green
}

Write-Host ""
Write-Host "確認用:" -ForegroundColor Cyan

foreach ($file in $targets) {
    if (Test-Path $file) {
        Write-Host "`n[$file]" -ForegroundColor Yellow
        Select-String -Path $file -Pattern '<Nav href=' |
            Select-Object -Last 5 |
            ForEach-Object { Write-Host $_.Line.Trim() }
    }
}

Write-Host ""
Write-Host "完了。続けて npm run build で確認してください。" -ForegroundColor Cyan
