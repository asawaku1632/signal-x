# MA75：上昇・下落相場別の研究（2026-11-18）

**SHADOW_NOT_APPROVED**。11/02の27銘柄と11/11の25銘柄を後から選別・再固定しない。今回は過去の結果を見た**後**で作る探索的な市場区分であり、利益を最大化する閾値調整は禁止。次の独立した判定日で同じ条件を固定して検証するまで有効性を主張しない。

## 先に分かる地合いと、その後の急落を区別

- **判定日時点の相場区分**：シグナル日を含む直近6取引日で、固定953銘柄の「5営業日前終値→シグナル日終値」をそれぞれ求め、**中央値**を算出。中央値が +1.0%以上 = UP（上昇）、-1.0%以下 = DOWN（下落）、その間 = SIDEWAYS（横ばい）。有効データが800銘柄に達しない場合は UNKNOWN（判定不能）。翌日以降の価格は区分に入れない。
- **保有中の市場変化**：次営業日始値→1/3/5営業日後終値で、シグナル候補を除く固定953母集団の平均騰落率を、候補群と同じく売買各0.1%の不利な仮想価格条件で計算。これは結果確認後の説明用データであり、シグナル時の売買判断には使えない。

固定953銘柄はSIGNALXで観測した偏りのある銘柄母集団であって、**TOPIXでも東証全銘柄でもない**。「固定953銘柄の地合い代理指標」と呼ぶ。異常値（連続日で45%超の急変等）や欠損を弾き、勝ち銘柄だけを取り出さない。

## 対象の2つの判定日

| 判定日 | シグナル数 | 5日前→判定日までの6取引日 | 仮想保有5日 |
| --- | --- | --- | --- |
| 2026-11-02 | 27、MA75上向き22 | 10/26, 10/27, 10/28, 10/29, 10/30, 11/02 | 11/04→11/10 |
| 2026-11-11 | 25、MA75上向き16 | 11/04, 11/05, 11/06, 11/09, 11/10, 11/11 | 11/12→11/18 |

出力内容は1/3/5営業日後について、候補全件・上向き・非上向き・予算適合群の平均／中央値／プラス率／最大勝者・最大敗者除外後と、非候補群の仮想平均、双方の差。予算適合群には、同じ予算フィルターの非候補対照も使う。

独立した観測単位は**判定日**。2日で52銘柄があることを52個の独立した相場事例とは数えない。上昇/下落それぞれ10日以上を最低の追加研究目安とし、複数月・外部検証も必要（10日は統計学的十分性の証明ではない）。

## Windows PowerShell で実行する（データ再取得・書込みなし）

~~~powershell
cd C:\Users\neomo\signal-x-minute-research

git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "ブランチ切替失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Git更新失敗" }

$reg = node .\scripts\research\ma75-frozen953-regime-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "相場区分研究失敗" }

$reg.samples | ForEach-Object {
    [PSCustomObject]@{
      判定日 = $_.signalDate
      相場区分 = $_.priorFiveSessionRegime
      直近5日中央値 = $_.priorFiveSessionMedianPercent
      有効銘柄数 = $_.preSignalProxyValidCodes
      候補数 = $_.frozenOriginalCandidates
      候補5日平均 = $_.horizons.session5.all.signals.mean
      非候補5日平均 = $_.horizons.session5.peer.all.mean
      候補と非候補の差 = $_.horizons.session5.all.differenceInMeansPoints
    }
} | Format-Table -AutoSize

$reg.samples | ForEach-Object {
  $day = $_
  @('session1','session3','session5') | ForEach-Object {
    $h = $day.horizons.$_
    [PSCustomObject]@{
      判定日 = $day.signalDate
      評価 = $_
      全候補平均 = $h.all.signals.mean
      上向き平均 = $h.rising.signals.mean
      非上向き平均 = $h.nonRising.signals.mean
      非候補平均 = $h.peer.all.mean
      候補と非候補の差 = $h.all.differenceInMeansPoints
    }
  }
} | Format-Table -AutoSize

$reg.comparison.marketRegimes | Format-List
~~~

### 注意事項

- 元の27銘柄／25銘柄のハッシュ照合が通らない場合、計算を停止。元データの差し替え、シグナルの再固定はしない。
- 既存のprivate J-Quants日足だけを利用する。APIキーや許諾対象の元データをGitHubにアップロードしない。無料で使えるTOPIXデータを代用したことにもならない。
- 953銘柄の母集団はアプリ由来なので、市場代理指標とシグナル群が業種・株価・時価総額で異なる。対照比較は観察研究であり、完全な統計的因果推定ではない。
- 2026-11-18時点で定めた閾値は、過去2例の探索的ラベル付け。どちらが良いかを後から選んで運用すると先読みバイアスになる。
- 研究専用。通知、ランキング、AI POWER、Supabase、本番デプロイ、証券取引への連携は一切行わない。
