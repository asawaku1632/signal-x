param([string]$ProjectRoot=".")

$targets=@(
@{Path="app/dashboard/page.tsx";Active="/dashboard"},
@{Path="app/today-market/page.tsx";Active="/today-market"},
@{Path="app/ranking/page.tsx";Active="/ranking"},
@{Path="app/scan-mobile/page.tsx";Active="/scan-mobile"},
@{Path="app/favorites/page.tsx";Active="/favorites"},
@{Path="app/alerts/page.tsx";Active=""},
@{Path="app/learning/page.tsx";Active=""}
)

function NewNav($active){
$items=@(
@{h="/dashboard";i="🏠";l="ホーム"},
@{h="/today-market";i="🤖";l="市場"},
@{h="/ranking";i="🏆";l="ランキング"},
@{h="/scan-mobile";i="🔍";l="スキャン"},
@{h="/favorites";i="⭐";l="お気に入り"}
)

$lines=@()
foreach($x in $items){
$a=if($x.h -eq $active){" active"}else{""}
$lines+="        <Nav href=`"$($x.h)`" icon=`"$($x.i)`" label=`"$($x.l)`"$a />"
}

@"
function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
$($lines -join "`r`n")
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
      className={
        active
          ? "text-center text-xs font-bold text-blue-600"
          : "text-center text-xs font-bold text-slate-500"
      }
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}
"@
}

foreach($t in $targets){
$f=Join-Path $ProjectRoot $t.Path
if(!(Test-Path $f)){continue}
$c=Get-Content -Raw -Encoding UTF8 $f
$n=NewNav $t.Active
$c=[regex]::Replace($c,'(?s)function\s+BottomNav\s*\(\s*\)\s*\{.*\z',$n)
Set-Content -Encoding UTF8 $f $c
Write-Host "更新: $($t.Path)"
}
Write-Host "完了"
