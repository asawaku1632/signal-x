param(
  [string]$ProjectRoot = "."
)

$targets = @(
  @{ Path = "app/dashboard/page.tsx"; Active = "/dashboard" },
  @{ Path = "app/scan-mobile/page.tsx"; Active = "/scan-mobile" },
  @{ Path = "app/today-market/page.tsx"; Active = "/today-market" },
  @{ Path = "app/ranking/page.tsx"; Active = "/ranking" },
  @{ Path = "app/favorites/page.tsx"; Active = "/favorites" },
  @{ Path = "app/alerts/page.tsx"; Active = "" },
  @{ Path = "app/learning/page.tsx"; Active = "" }
)

function Get-BottomNavCode([string]$activePath) {
  $items = @(
    @{ href = "/dashboard"; icon = "🏠"; label = "ホーム" },
    @{ href = "/scan-mobile"; icon = "🔍"; label = "検索" },
    @{ href = "/today-market"; icon = "🤖"; label = "市場" },
    @{ href = "/ranking"; icon = "🏆"; label = "ランキング" },
    @{ href = "/favorites"; icon = "⭐"; label = "お気に入り" }
  )

  $navLines = foreach ($item in $items) {
    $active = if ($item.href -eq $activePath) { " active" } else { "" }
    "        <Nav href=`"$($item.href)`" icon=`"$($item.icon)`" label=`"$($item.label)`"$active />"
  }

  return @"
function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
$($navLines -join "`r`n")
      </div>
    </nav>
  );
}

function Nav({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-center text-xs font-bold ${
        active ? "text-blue-600" : "text-slate-500"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}
"@
}

$updated = 0

foreach ($target in $targets) {
  $fullPath = Join-Path $ProjectRoot $target.Path

  if (-not (Test-Path $fullPath)) {
    Write-Host "見つからないためスキップ: $($target.Path)" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content -Raw -Encoding UTF8 $fullPath

  if ($content -notmatch 'function\s+BottomNav\s*\(\s*\)') {
    Write-Host "BottomNavが見つからないためスキップ: $($target.Path)" -ForegroundColor Yellow
    continue
  }

  $newBottomNav = Get-BottomNavCode $target.Active

  # 各ページ末尾にある古い BottomNav / Nav をまとめて完成版へ差し替える
  $newContent = [regex]::Replace(
    $content,
    '(?s)function\s+BottomNav\s*\(\s*\)\s*\{.*\z',
    $newBottomNav
  )

  Set-Content -Path $fullPath -Value $newContent -Encoding UTF8
  Write-Host "更新完了: $($target.Path)" -ForegroundColor Green
  $updated++
}

Write-Host ""
Write-Host "$updated ファイルを更新しました。" -ForegroundColor Cyan
Write-Host "下部ナビ: ホーム / 検索 / 市場 / ランキング / お気に入り" -ForegroundColor Cyan
