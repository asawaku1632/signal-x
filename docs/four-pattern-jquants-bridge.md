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
