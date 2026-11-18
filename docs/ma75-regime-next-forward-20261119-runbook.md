# SIGNALX｜MA75相場別研究・次の独立判定日 2026-11-19

**研究専用：SHADOW_NOT_APPROVED。** 2026-11-18に新しい日付のシグナル確定前にルールをGitHub上で事前宣言。11月2日の27銘柄・11月11日の25銘柄のハッシュと研究用ファイルは編集しない。新候補を未来の結果で選び直さない。

## 固定ルール

- 固定母集団：2026-10-31に保存した元の953銘柄（東証全銘柄でもTOPIXでもない）
- 判定日：**2026年11月19日（木）**の日足終値、過去75営業日の元データからSMA75上抜け候補を抽出
- 相場区分：同じ953銘柄の**判定日まで直近5営業日騰落率中央値**。UP >= +1%、DOWN <= -1%、その他 SIDEWAYS、有効800銘柄未満は UNKNOWN
- SMA75上向き/非上向き、予算10万円〜50万円、最大勝者・敗者をそれぞれ除いた成績を比較
- 翌営業日11月20日の始値で仮想購入、1/3/5営業日後の終値で仮想決済。売買各0.1%の不利な価格条件。実際の約定ではない
- 非候補銘柄とも同じ期間・同じ仮想費用条件で比較し、実測された非候補銘柄数/欠損数を別々に報告
- 相場区分は19日終値で固定し、保有中に起きた市場下落を事前の売買判断に逆流させない

### 対象日付

| 役割 | 日付 |
| --- | --- |
| シグナル日 | 11月19日（木） |
| 1営業日後 | 11月20日（金） |
| 2営業日後（途中データ） | 11月24日（火） |
| 3営業日後 | 11月25日（水） |
| 4営業日後（途中データ） | 11月26日（木） |
| 5営業日後 | 11月27日（金） |

**11月23日（月）は勤労感謝の日の東証休場日。** JPX公式カレンダー：https://www.jpx.co.jp/corporate/about-jpx/calendar/index.html

## ① 2026年11月18日：準備状況だけ確認

ここではファイル書込みゼロ・API通信ゼロ。**本日、候補固定コマンドはまだ実行しない。**

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチ切替失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Git更新失敗" }

node .\scripts\research\ma75-regime-20261119-local.mjs --plan
if ($LASTEXITCODE -ne 0) { throw "11月19日研究計画の確認失敗" }
~~~

NOV19_PREDECLARED_PLAN_ONLY、SHADOW_NOT_APPROVED、networkRequests: 0、filesWritten: 0 が正常な計画出力。実際の19日候補数はまだ不明。

## ② 11月19日16:30以降かつ20日9:00より前に、一度だけ固定

その日のJ-Quants元データが提供済みであることを確認して、以下を**それぞれのコマンドが終わってから**実行する。16:30は安全な取得時刻下限であって、提供元の公開完了を保証しない。

~~~powershell
cd C:\Users\neomo\signal-x-minute-research

$p = .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-19 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "11月19日の日足事前確認失敗" }
$p | Select-Object date,status,alreadyStored | Format-List

if ($p.alreadyStored -ne $true) {
    .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-19 -Execute
    if ($LASTEXITCODE -ne 0) { throw "日足取得失敗" }
}

node .\scripts\research\ma75-regime-20261119-local.mjs --lock-before-next-open
if ($LASTEXITCODE -ne 0) { throw "候補の事前固定失敗" }

node .\scripts\research\ma75-regime-20261119-local.mjs --verify-only
if ($LASTEXITCODE -ne 0) { throw "候補の整合性検証失敗" }
~~~

ロックは一度しか許可しない。専用のgitignore対象ローカルファイル
research-private/ma75-2026-11-19-regime-lock.json
を wx（新規作成専用）で書込み、再実行は拒否する。期限後の新規固定も拒否。元のNov2・Nov11コホートと元のJ-Quants日足は変更しない。

固定時に breakouts、rising、nonRising、regime、lockSha256 を表示する。0銘柄なら0件をそのまま残す。候補が多い日だけ採用することも禁止。

## ③ その後は本当に日足が公開された日だけ取得

11月20日、24日、25日、26日、27日の**それぞれ16:30以降**に、既存の ma75-run-forward-day-local.ps1 -Date YYYY-MM-DD で事前確認。未保存の場合のみ明示的な -Execute で新規取得する。自動API課金・クラウドcronや本番連携は設定しない。

取得済みファイルだけで途中確認：

~~~powershell
$r = node .\scripts\research\ma75-regime-20261119-local.mjs --review | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "研究検証失敗" }

$r | Select-Object status,signalDate,priorMarketRegime,originalBreakouts,sourcesObserved | Format-List

@('session1','session3','session5') | ForEach-Object {
    $k = $_
    $h = $r.horizons.$k
    [PSCustomObject]@{
        評価 = $k
        終了日 = $h.exitSession
        MA75測定数 = $h.groups.all.measured
        MA75未確定 = $h.groups.all.pending
        MA75平均 = $h.groups.all.mean
        MA75上向き平均 = $h.groups.rising.mean
        MA75非上向き平均 = $h.groups.nonRising.mean
        非候補測定数 = $h.peer.measured
        非候補未確定 = $h.peer.pending
        非候補平均 = $h.peer.mean
        相対差 = $h.signalMinusPeerPoints
    }
} | Format-List
~~~

元データの提供時刻・許諾・実約定は独立認証されておらず、プラス率が高くてもトレード解禁不可。

## 研究上の留意点

- Nov2/Nov11の相場分類は結果を見た後に作った探索的分析。Nov19以降は新規固定する独立した判定日として観測する（銘柄数を独立した市場日数と勘違いしない）。
- 11月19日用の研究ルール・日付は変更しない。将来の別判定日はその日より前に別の宣言を追加する。
- 固定953銘柄の母集団には業種・流動性等の選択バイアスがある。非候補比較も因果的な優位性の証明ではない。
- SHADOW_NOT_APPROVED、eligibleForTrading: false、eligibleForNotifications: false、eligibleForProduction: false を維持する。DB、売買、通知、本番デプロイ、PRマージは実施しない。
