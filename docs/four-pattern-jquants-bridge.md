# SIGNALX 4手法 × J-Quants V2 過去データ接続（研究専用）

This is a local historical bridge, not an intraday real-time feed, deployed API route, database ingestion service, or notification source.

## この版でできること

- One explicitly selected TSE code and 1–20 specified completed trading dates.
- Explicit bounded J-Quants API V2 GET for one code/date on minute and daily endpoints; optional single-code financial summary GET.
- Full pagination chain and receipt timestamps recorded privately.
- A minute day is accepted only when its unadjusted OHLCV and volume reconcile to the original same-code provider daily row, with no unresolved split/rights metadata.
- Construct 30m and 60m fully closed, session-aware bars. Lunch not bridged; 11:30 and 15:30 auction minutes included in respective final bar. No-trade minutes are never invented.
- Historical four-pattern performance compares 1/3/5 bars after the signal (not business days). Signals and counterfactual outcomes are separated.
- Financial rows are matched using the same fiscal period type and period-end exactly one year earlier. Revenue and operating profit growth are calculated from disclosure values; the equity ratio EqAR is fractional (e.g. 0.47 = 47%); CFO must exist and be positive.
- Financial features become usable no earlier than the actual local archive receipt time. Fetching 2025 statements in November 2026 does not imply the application saw the figures in 2025.
- Any incomplete financial period or absent cash-flow number results in no quality signal.

## Official source contract

- Minute OHLCV https://jpx-jquants.com/ja/spec/eq-bars-minute
- Daily OHLCV https://jpx-jquants.com/ja/spec/eq-bars-daily
- Financial Summary https://jpx-jquants.com/ja/spec/fin-summary
- Vendor update timing https://jpx-jquants.com/ja/help/data

Minute data require the minute/tick add-on. Vendor rights and access remain unverified by this module. Disclosure date/time (DiscDate/DiscTime) is not the same as when J-Quants made a record available. No authenticated J-Quants requests were made by the assistant during implementation.

## Windows PowerShell (from repository root)

After code is merged and your local checkout is updated, use your existing protected local environment. NEVER paste the API key into chat, CLI flags or screenshots.

Dry-run with zero API calls and zero secrets read:

    node .\scripts\research\capture-four-pattern-jquants.mjs --code=3762 --dates=2026-10-29,2026-10-30

The dry-run shows a maximum request count (24 for two dates including optional financial data), but does not contact the provider.

To deliberately run private bounded capture only after verifying subscription rights and the existing JQUANTS_API_KEY environment variable:

    $env:JQUANTS_RESEARCH_PROBE_ENABLED = "true"
    node .\scripts\research\capture-four-pattern-jquants.mjs --code=3762 --dates=2026-10-29,2026-10-30 --execute

For meaningful 60m history, specify enough completed dates for at least 80 actual 60m bars (typically around 15–20 trading sessions). Dates must be ascending and explicitly supplied; no calendar scan or full-market loop is performed.

Capture is create-only into a gitignored private local file:

    .private-research/four-pattern-jquants-3762-2026-10-29-2026-10-30.json

Never commit this raw licensed archive. Review summaries without printing raw market rows:

    node .\scripts\research\run-four-patterns-jquants-bundle.mjs .\.private-research\four-pattern-jquants-3762-2026-10-29-2026-10-30.json

The result includes each timeframe status, signal count and 5-bar outcomes. Less than 80 aggregated bars remains unverified.

If the financial-summary entitlement is unavailable, the capture command supports --skip-financial. In this mode the quality-fundamentals strategy remains disabled.

## Safety contract

- API calls need BOTH --execute and JQUANTS_RESEARCH_PROBE_ENABLED=true, plus an existing securely stored JQUANTS_API_KEY. Nothing is scheduled.
- Only three allowlisted HTTPS vendor endpoints; no redirects; no-store and no credentials; sanitized error messages.
- Max 20 dates, four pages per minute and daily date, eight financial pages, 600 financial rows. Incomplete continuation chains fail closed.
- No live orders, alerts, automated production data loading, AI POWER scoring or DB writes.
- The minute series has no same-minute trade sequence; previous high/low is not an executed price guarantee.
- J-Quants minute archive retrieved after the session cannot provide live 9:05 or 9:15 signals.
- Financial CFO data may be absent; corrections, consolidations, accounting changes and fiscal year changes require separate review. Ambiguous data is excluded instead of filled.
- Source licensing, vendor entitlement and contemporaneous availability require separate verification before production use.

## Tests

    node --test tests/fourPatternJQuantsBridge.test.mjs tests/fourPatternJQuantsCapture.test.mjs tests/fourStrategyShadow.test.mjs

These CI tests use mock historical records and never call authenticated provider endpoints. They cannot establish profitable performance or real-time data availability.


## 2026-11-05: 財務開示メタデータの欠損に対する隔離対応

銘柄3762で、分足・日足の照合後に FINANCIAL / INVALID_DISCLOSURE_METADATA が報告された。個別の欠損フィールドは生データを公開していないため未確定。

- J-Quants 財務サマリーの開示書類には、対象外の書類や項目欠損が含まれる場合がある。取引判定に利用する FY/1Q/2Q/3Q の候補レコードだけを開示日時・番号の形式確認対象にする。
- 対象書類の開示日、時刻、開示番号が不正・欠損ならその行を隔離する。日時を開示番号や会計年度終了日から推定しない。
- 一件でも対象書類の不明な開示メタデータがあれば、訂正開示との関係を安全に判断できないため **財務ベースの QUALITY_PULLBACK シグナル全体を禁止**する。株価ベースの他3手法は独立に研究できる。
- 問題のデータを黙って「正常」と扱わない。集計した件数と財務品質ステータスを返し、対象書類・金額・開示番号・APIキーは標準出力に表示しない。
- 未来開示時刻、銘柄コード不一致、開示番号重複、時刻証跡の不整合は引き続き重大なエラーとして取得結果を停止する。
- 標準プランの財務更新タイミングと実際の取得日時は別物。後から取得した財務データは、過去の時点で利用可能だったと認定しない。

### 再確認

PowerShellで最新 main を取得後、取得済みAPIキーを設定した同じセッションなら、従来の --execute コマンドで実データを再取得できる。出力の financialStatus が FINANCIAL_METADATA_QUARANTINED_QUALITY_DISABLED であれば財務シグナルは無効であり、株価3手法の研究用データだけが照合可能。実際の対象日が2日しかない場合、80本の30分/60分足に届かず勝率は未検証のままとなる。

財務データの正式な項目定義:
https://jpx-jquants.com/ja/spec/fin-summary


## 2026-11-05: 1・3・5営業日後の「保有期間別」答え合わせ

従来の30m/60m研究の集計は 1・3・5 **ローソク足** 後であり、3〜5営業日のスイング運用とは別の保有期間だった。新機能は同じローカルの過去取得ファイルを読み直すだけで、営業日単位の仮想結果を集計する。

### PCで実行（API通信0回）

    node .\scripts\research\run-four-pattern-trading-days.mjs .\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json

出力の評価ルール:
- 対象: 30分足・60分足の確定時点で過去だけから判定された4手法のシグナル。財務を取得しなかった場合はその手法を発生させない。
- 関連する東証市場営業日は、既存のバージョン固定 JPX/TSE カレンダーで厳密に確認。土曜、日曜、日本の祝日、JPX休業日を飛ばす。
- アーカイブに途中の営業日が欠けていれば、1営業日と2営業日を混同しないよう **結果全体をブロック**。他の日時のローソク足で欠損日を補間しない。
- シグナル翌営業日の最初の約定始値で仮想購入。シグナル日から1・3・5営業日目の最後の約定終値で仮想決済。売買単位100株、売買各0.1%の摩擦。
- 100株分が50万円を超える場合は予算外として成績の母数から除外。取得済み最終日より後の評価対象は PENDING とし、勝率や平均リターンへ混入させない。
- 同じ時間足・同じ手法・同じ日付では「最初のシグナル」だけを採用し、実際には独立でない多重アラートの見かけのサンプル増加を抑える。30m・60m間の同一トレード重複はまだ除去していないため、同一の統計母数に足し合わせない。
- 平均・中央値・プラス率・100株当たり損益、未確定件数を別々に出力。個別株価の分足/日足元データは表示しない。

これは過去の事後取得時点での純粋な仮想答え合わせであり、当時9:05/9:15の利用可否、約定、スプレッドや気配、滑り、勝率の将来再現性を証明しない。全銘柄横断の検証や、前向き凍結を伴う FORWARD 期間は未着手。利益額は過去の仮定上の結果で、利確・損切り注文の実行結果ではない。

### テスト

    node --test tests/fourPatternTradingDayForward.test.mjs tests/fourStrategyShadow.test.mjs tests/fourPatternJQuantsBridge.test.mjs tests/fourPatternJQuantsCapture.test.mjs

この追加は SHADOW ONLY / ローカルのみ。既存保存ファイルを上書きせず、APIキーへのアクセス・ネットワーク接続・本番DB/通知/売買を行わない。


## 2026-11-05: Multi-stock cohort / 30m + 60m duplicate control (SHADOW ONLY)

Existing sample: security 3762, 20 JPX trading days (2026-10-06 to 2026-11-04), 5,584 matched original one-minute bars. The prior one-symbol 1/3/5 trading-day outcomes are **in-sample anecdotes**, not evidence of tradable signal superiority.

New files:
- \`app/lib/research/fourPatternMultiStockShadow.mjs\`
- \`scripts/research/run-four-pattern-multistock-shadow.mjs\`
- \`tests/fourPatternMultiStockShadow.test.mjs\`

### Exact existing time-window requirement

All compared symbols MUST have complete, individually reconciled J-Quants original minute/daily archives on **the identical 20 dates**, with all listed JPX trading sessions consecutive. Any mismatch, invalid record, duplicate stock code, conflicting timeframe outcomes, or financial inclusion blocks the cohort. Silent gap filling is prohibited. A 2026-10-29–10-30 two-day archive is NOT comparable to a 2026-10-06–2026-11-04 twenty-day archive.

New capture commands are optional and local; do NOT re-fetch 3762 if already archived. Example for **another user-selected, entitled symbol** (substitute its real four-digit code):

    node .\scripts\research\capture-four-pattern-jquants.mjs --code=7203 --dates=2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-19,2026-10-20,2026-10-21,2026-10-22,2026-10-23,2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-11-02,2026-11-04 --skip-financial

That command is **DRY_RUN_ZERO_API** by default; add \`--execute\` only after separately setting \`JQUANTS_RESEARCH_PROBE_ENABLED=true\` and private \`JQUANTS_API_KEY\`, confirming usage limits and permitted data use. One 20-day 2-endpoint file can plan up to 160 HTTP requests (max 4 pages for each day/endpoint), actual count varies. Files are written exclusively under ignored \`.private-research/\`. They must not be pushed or posted to public PRs.

### Local read-only multi-stock comparison

    node .\scripts\research\run-four-pattern-multistock-shadow.mjs .\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json .\.private-research\four-pattern-jquants-7203-2026-10-06-2026-11-04.json

Explicit 1–30 local filenames, max 8MB per file; no wildcard directory scanning or provider access. One file produces \`SINGLE_STOCK_PILOT_SHADOW_ONLY\` and cannot be characterized as a multi-stock research result.

**Frozen prior-to-outcomes methodology**:
- Price signals only: BREAKOUT_RETEST, EMA_COMPRESSION, HIGHER_LOW. QUALITY_PULLBACK requires verified financial data and remains outside this cohort.
- 30-minute and 60-minute signals within the same stock/day/strategy are de-duplicated, retaining the earliest closed-candle signal; tie breaks to 30 minutes. A disagreement in the supposedly common daily outcome blocks results rather than hiding discrepancies.
- One result per strategy/stock/day is used for by-strategy tables. Different strategies may flag the same stock/day; a separate **portfolio view** conservatively keeps only the earliest signal across strategies per stock/day. Do not add by-strategy counts to claim independent trades.
- Buy at the next JPX trading day's first traded price and hypothetically sell at the close 1/3/5 JPX trading sessions after the signal; per-side 0.1% friction, 100 shares, <=500,000 JPY entry budget. Same frozen strategy conditions as existing one-stock report.
- Partial future outcomes remain \`PENDING\`; exceeded budgets are \`BUDGET_EXCLUDED\`; neither enter win-rate or mean-return denominators. Trade and portfolio summaries include measured count, unique symbols/dates, positive-return frequency, mean, median, worst hypothetical loss, worst adverse move, and shares of outcomes >=7,000 JPY, >=10,000 JPY, <=-10,000 JPY.
- Cross-timeframe and per-strategy de-duplication does **not** eliminate serial dependence, correlated sector moves, cherry-picked symbols, or hindsight from choosing the sample. Multiple date windows, prospective frozen cohorts and enough independent market regimes are needed before promoting any hypothesis.
- \`historicalAsOfMarketDataWasNotLive=true\`, \`canTriggerTrade=false\`, \`eligibleForNotifications=false\`, and \`researchEvidenceStatus=NOT_VALIDATED_FOR_TRADING\` remain hard stops. No realized orders, returns, or production signal claims.

### Testing

    node --test tests/fourStrategyShadow.test.mjs tests/fourPatternJQuantsBridge.test.mjs tests/fourPatternJQuantsCapture.test.mjs tests/fourPatternTradingDayForward.test.mjs tests/fourPatternMultiStockShadow.test.mjs

No new scheduled fetch, automatic order, notification trigger, Supabase write, Vercel secret, GitHub-hosted raw J-Quants dataset, or rule-fitting feature is introduced.


## 2026-11-05: Multi-stock attribution and overlapping-method audit

After the 3-stock retrospective pilot (3762/7203/7752; all dates 2026-10-06 to 2026-11-04), the original multi-stock summary had a methodological blind spot: the "portfolio" view keeps the earliest signal across all methods for a stock/day. In the observed pilot its 29 chosen stock/day records have the *same published aggregated result* as the HIGHER_LOW method, whereas standalone EMA_COMPRESSION has a 3-day mean of +8,449 JPY (n=3), median +1,879 JPY. That aggregate difference does **not** demonstrate a safe EMA-first alternative because no such strategy has been independently validated.

The new audit adds only immutable-descriptive output to the *same command*:

- \`byStock\`: original 4-digit code and per-method 1/3/5-day aggregate outcomes (completed/pending/budget-excluded counts, win rate, mean/median, hypothetical 100-share profit and worst per-example profit), plus the conservative earliest-signal portfolio outcomes. No licensed provider rows, individual trades, timestamps or OHLCV values are printed.
- \`portfolioSelectionAudit\`: how many stock-date pairs have competing methods; which methods were **chosen solely by earlier confirmed candle time** and which were excluded; cross-method pair counts. Does not re-score or choose the best realized outcome.
- File set, market calendar, 100 shares, per-side 0.1% friction, 500,000-JPY budget, one-per-stock/date portfolio policy, and original 1/3/5-day outcomes stay exactly as in #306.
- This is attribution only: it cannot prove that emphasizing EMA (or choosing another entry priority) would beat the earliest-signal policy out-of-sample. No automatic order, alerts, deployment or changed trade logic.

### Offline execution
With the original three private files still in the local ignored folder:

    node .\scripts\research\run-four-pattern-multistock-shadow.mjs .\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json .\.private-research\four-pattern-jquants-7203-2026-10-06-2026-11-04.json .\.private-research\four-pattern-jquants-7752-2026-10-06-2026-11-04.json

The new keys only explain where the existing in-sample mean came from, and why some by-strategy signals never appear in the conservative portfolio. They are NOT a basis for notification release.


## 2026-11-05: In-sample LOSO sensitivity audit and next-period replication preregistration

### Existing 2026-10-06–11-04 three-stock result is highly sensitive

EMA_COMPRESSION / 3 JPX trading days, hypothetical 100 shares, 0.1% per-side friction:
- 3762: +25,784 JPY
- 7203: -2,317 JPY
- 7752: +1,879 JPY
- Pooled: +8,449 JPY (n=3, median +1,879)
- Without 3762: -219 JPY (n=2)
- Without 7203: +13,832 JPY (n=2)
- Without 7752: +11,734 JPY (n=2)

That is not a robust edge; it is an ex-post analysis of three observations sharing two signal dates. The existing local multistock command now reports \`leaveOneStockOut\` for **every** method / 1, 3 and 5 JPX trading-day horizon and the conservative portfolio. It calls the **same** proven dedup and outcome engine on each strict subset of already evaluated archives; no data is fetched again, parameters are unchanged, and unknown/PENDING outcomes stay unmeasured.

    node .\scripts\research\run-four-pattern-multistock-shadow.mjs .\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json .\.private-research\four-pattern-jquants-7203-2026-10-06-2026-11-04.json .\.private-research\four-pattern-jquants-7752-2026-10-06-2026-11-04.json

This program is an **IN-SAMPLE leave-one-stock-out stress test**, not a forward validation or another independent market regime. Correlated signals and outcomes remain dependent.

### Frozen 20-trading-day next-period plan, authored before it begins

The separate code \`app/lib/research/fourPatternReplicationPlan.mjs\` predeclares an immutable evaluation design. The Git commit timestamp and fixed tests establish when the plan was authored, not the stock returns. Read it safely via:

    node .\scripts\research\show-four-pattern-replication-plan.mjs

This plan takes **no API action, no scheduled job and no orders**. Exact next 20 JPX trading dates are fixed:

    2026-11-06,2026-11-09,2026-11-10,2026-11-11,2026-11-12,
    2026-11-13,2026-11-16,2026-11-17,2026-11-18,2026-11-19,
    2026-11-20,2026-11-24,2026-11-25,2026-11-26,2026-11-27,
    2026-11-30,2026-12-01,2026-12-02,2026-12-03,2026-12-04

JPX holiday 2026-11-23 is deliberately excluded. Fixed stock codes: previously examined \`3762\`, \`7203\`, \`7752\`; and additional comparison names \`1301\`, \`3402\`, \`9005\`. They are **not** stock purchase recommendations or a random statistically representative universe. No substitute stocks or dates after observing the results.

Research assumptions remain frozen: 30-minute and 60-minute confirmed candles; price-only BREAKOUT_RETEST / EMA_COMPRESSION / HIGHER_LOW; 1/3/5 JPX trading-day horizons; next-day open entry and target-day close exit; 100 shares; 0.1% per side; max purchase price 500,000 JPY; conservative first-signal per stock/date dedup; unresolved future labels PENDING. All licensed raw data stays in ignored local storage.

**Data has not yet been captured**. J-Quants V2's historical data for this future window cannot be acquired now. Each one-stock 20-date capture is separately opt-in and has a planned maximum of 160 API requests at four pages per endpoint; six would have an overall upper bound of 960, though actual usage may be lower. Check account limits, permitted usage and publication latency before executing. Do not capture unpublished sessions or run automatic captures from the repository.

After verified end-of-window data becomes available, compare all six exact same-date archives using \`run-four-pattern-multistock-shadow.mjs\`. If the final signal-days' outcomes need later daily prices, leave them PENDING; the follow-up end-date extension must be separately designed and verified before making a 5-day claim. **Do not** mislabel historical bulk retrieval as live market availability at the original decision time, nor promote any pattern without genuinely prospective capture and sufficiently many independent observations.

The plan is designed to prevent silent post-hoc redefinitions; it is not itself a successful holdout test. Notification and production flags remain false.
