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


## ④ 2026-11-20 — 1-session owner-local observations (not independently authenticated)

User-provided derived PowerShell output after local \`--review\` (not the
licensed source files). **12/12 fixed signals measured; 0 pending, 0
quarantined**. Lock and signal-date DOWN regime were fixed on Nov19;
same-day source availability and real fills are not independently verified.

| Nov19 cohort, hypothetical Nov20 close | Fixed | Measured | Mean net % | Median net % | Positive rate % | Largest winner | Mean excluding biggest winner % | Biggest loser | Mean excluding biggest loser % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: |
| All | 12 | 12 | +0.0810 | -0.3456 | 25.0000 | 6315 | -0.2880 | 9404 | +0.2554 |
| MA75 rising | 4 | 4 | +1.4937 | +1.0175 | 50.0000 | 6315 | +0.6118 | 4725 | +2.0581 |
| MA75 non-rising | 8 | 8 | -0.6254 | -0.6883 | 12.5000 | 2908 | -0.8106 | 9404 | -0.4521 |
| Budget eligible | 11 | 11 | +0.0885 | -0.4913 | 27.2727 | 6315 | -0.3165 | 9404 | +0.2812 |
| Budget rising | 3 | 3 | +1.9924 | +2.0377 | 66.6667 | 6315 | +0.9190 | 4725 | +3.0885 |
| Budget non-rising | 8 | 8 | -0.6254 | -0.6883 | 12.5000 | 2908 | -0.8106 | 9404 | -0.4521 |

Positive count is three of twelve overall, two of four rising, one of
eight non-rising. Positive **mean** is driven partly by code 6315, and
the overall **median** is negative. Rising-group mean remains positive
when dropping its biggest winner but sample is only three codes.

### Subsequent owner-provided non-signal benchmark — Nov20 session 1

The owner also supplied the separate \`session1.peer\` read-only
summary: **940 measured non-signal codes out of the frozen 941 non-signal
codes, 1 pending**, mean hypothetical net **-1.5858%**.
The pre-fixed 12 MA75 breakout candidates averaged **+0.0810%**.
The difference is **+1.6668 percentage points** (0.0810 - (-1.5858)).
This qualifies for the locally predeclared peer coverage comparison
(940 observed codes >= 800 required); it is **not TOPIX** and is not
industry-, size-, or liquidity-matched.

The 12-code signal cohort has **25% positive returns (3/12)** and
a **-0.3456% median**. Excluding its single biggest winner
(6315) changes the signal mean to **-0.2880%**, which is still
**+1.2978 percentage points** versus the UNCHANGED 940-code
non-signal reference. This is a posthoc descriptive stress
check, not a matched causal estimate or a trading rule.

No claim of repeatability from one new DOWN-market date.
Do not substitute previous-date benchmark or raw TOPIX values.
Day 3 and day 5 remain pending: Nov25 and Nov27;
Nov23 is a JPX holiday.

No trading rule change, production promotion, notification activation,
or manipulation of the fixed original 12 codes. The same subgroup
definitions and transaction-friction assumptions remain in force.


## ⑤ 2026-11-25 — owner-local 3-session comparison (observational)

On Nov 25 the owner executed the Nov19 locked study in a **separate
MA75 git worktree** rooted at \`C:\Users\neomo\signal-x-ma75-validation\`
(so the separately used BB-candle worktree and its many untracked
research files did not need to be altered). The output confirmed
\`LOCK_VERIFIED=TRUE\`, \`allRequiredOriginalDaysPresent=True\`,
and \`MA75_3DAY_CHECK_COMPLETE\`. Exactly 12/12 pre-frozen MA75
candidates and 940/941 non-signals were measured. The locked signal-date
regime was **DOWN**. Results are derived PowerShell printouts supplied
by the owner, not raw provider pages or independently authenticated
entry/exit fills.

| Metric | Nov20: 1 session | Nov25: 3 sessions |
| --- | ---: | ---: |
| All 12 breakout mean net % | +0.0810 | +1.1690 |
| All 12 median net % | -0.3456 | +1.5793 |
| All 12 positive rate % | 25.0 (3/12) | 75.0 (9/12) |
| Rising MA75 (4) mean net % | +1.4937 | +1.8357 |
| Non-rising MA75 (8) mean net % | -0.6254 | +0.8356 |
| Non-signal peers (940 measured) mean net % | -1.5858 | -0.2346 |
| All-signal minus peer mean, percentage points | +1.6668 | +1.4036 |
| All-signal mean excluding largest single winner % | -0.2880 | +0.7891 |

The Nov25 outlier-excluded 11-code signal mean (+0.7891%) is
+1.0237 pp above the unchanged 940-code peer mean (-0.2346%).
This is an **exploratory** leave-one-signal-winner-out check:
unmatched universes and unequal group sizes remain. The individual
Nov25 largest-winner code was **not** supplied; do not assume it
remained 6315. For Nov25, the 3-session averages are measured
from Nov20 hypothetical opening entry to Nov25 hypothetical close
with the original 0.1% buy and 0.1% sell frictions.

Caution: this is a positive **single signal-day example**, not proof
of a robust future strategy or a causal effect of MA75. The +1.4036
pp relative advantage is *smaller* than the session-1 +1.6668 pp
advantage, even while the MA75 absolute mean and positive rate improved.
The 1-session and 3-session samples are the **same 12 codes**, not
two statistically independent signal dates. The 5-session Nov27
evaluation remains pending; raw 2026-11-26 and 2026-11-27 sources
must be available and verified before claiming it.

Status remains **SHADOW_NOT_APPROVED**, no production writes,
trades, rankings, or notification activation.
