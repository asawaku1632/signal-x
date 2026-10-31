# SIGNALX: J-Quants one-minute historical pilot — 2026-11-01

**Status:** SHADOW, offline-first, nontrading. User reported activating the ¥5,500/month **株価 分足・ティック** add-on on 2026-11-01; provider entitlement and monthly charge are not independently verified by these files.

## Verified provider API contract

Official source: https://jpx-jquants.com/ja/spec/eq-bars-minute

- \`GET /v2/equities/bars/minute\`, with a 4-character \`code\` and \`date\`, plus \`pagination_key\` when returned.
- \`data\` rows contain \`Date\`, \`Time\` (start minute in JST), five-character \`Code\`, unadjusted \`O/H/L/C\`, share volume \`Vo\`, and traded value \`Va\`. Row ordering is NOT guaranteed.
- No transaction in a minute means the **entire minute bar can be absent**; do not fill it with interpolated prices. The first executed trade may occur after 09:00. The 11:30 and 15:30 auctions have their own minute rows, and there is normally no bar at 15:25–15:29.
- This is a **historical daily-updated** dataset (usually around 16:30 JST), **not a real-time 09:05 feed**: https://jpx-jquants.com/en/spec/data-update .
- API provides no independently signed vendor record or actual original publish timestamp; corrections may overwrite the prior content. A fetch timestamp proves only when the app received a later response.

## What is committed

- \`app/lib/research/morningMinuteShadow.mjs\`: pure offline response-envelope verifier and morning study. It requires explicit existing frozen-cohort membership, one trade date, complete ordered pagination, valid code/class/date and plausible price-volume-turnover geometry. A full morning result does **not** require trading in every minute.
- A retrospective, hypothetical 09:05 feature snapshot uses only **09:00–09:04** executed minute rows. A 09:05 bar includes trades from 09:05:00–09:05:59 and must NEVER enter features claimed to exist at 09:05:00.
- A **separate hindsight-only** outcome measures the earliest 09:00–09:59 minute low and the maximum high in strictly **later** minute rows in that one-hour window. The 1% and 2% thresholds are *post-low potential paths*, **not achievable trade P&L or guaranteed order of high and low within the same minute**. No purchase price, commission, spread, slippage, limit order execution or market conditions are modeled yet.
- \`scripts/research/jquants-minute-pilot.mjs\`: user-triggered, **dry-run by default**, limited to **one frozen symbol × one completed trade date × 4 API pages maximum**. No API key read or network unless BOTH \`--execute\` is passed AND \`JQUANTS_RESEARCH_PROBE_ENABLED=true\` is set in the trusted runtime. The key is supplied only by already protected \`JQUANTS_API_KEY\` environment variable, never via CLI flags or chat. The API helper itself also enforces the one-code/date/four-page boundary. 403 and 429 are redacted to error codes; raw rows are not written to files or databases. If pagination remains incomplete after four pages, research is BLOCKED, not assumed complete.
- \`tests/morningMinuteShadow.test.mjs\` + \`tests/jquantsMinutePilot.test.mjs\`: **31/31** targeted GitHub-source V8 functional tests passed with mocked network, not a native Node CI or live vendor entitlement proof.

### Exact dry-run from repository root

A frozen code confirmed present in \`docs/ma75-forward-cohort-freeze-20261031.json\` is \`3762\`. Code \`3753\` is **not** present in this pre-frozen 953-code population and the pilot must reject it. That is deliberate; it prevents hindsight selection of a favorable stock inside this daily cohort.

\`\`\`bash
node scripts/research/jquants-minute-pilot.mjs --code=3762 --date=2026-10-30
\`\`\`

This performs **zero network requests** and does **not** read the environment API key. The extra subscription flag is not proof of actual access.

### Optional bounded vendor connectivity check (only in a secure runtime)

After securely verifying the runtime has \`JQUANTS_API_KEY\` and setting \`JQUANTS_RESEARCH_PROBE_ENABLED=true\` on that test runtime, run:

\`\`\`bash
node scripts/research/jquants-minute-pilot.mjs --execute --code=3762 --date=2026-10-30 --max-pages=4
\`\`\`

No key is shown on the command line or in log output. This would make at most four date-scoped, read-only requests for one stock. **This step has not been run by the assistant**: the connected Vercel integration exposes environment-variable *names* but not a safe execution environment for a private authenticated HTTP call without retrieving secret values. Neither API permissions nor actual returned bar counts are claimed to be verified.

For a larger multi-day/full-market study, first verify the add-on's license and the dataset agreement; consider J-Quants' bulk CSV path rather than an unbounded series of API calls. Explicit study population, capture timestamps, Japanese trading calendar, stock corporate actions and non-survivor outcomes must be retained. A speculative 09:05 alert would additionally require a separately authorized current-time feed: **this historical provider does not give it**.

No live API call, new subscription charge, database write, scheduled task, production deployment, AI POWER scoring, notification, auto-trading, or changes to PR #216/#292 were performed.


## Transport hardening and official minute schema check (2026-11-01)

Official [J-Quants v2 minute contract](https://jpx-jquants.com/ja/spec/eq-bars-minute) was checked against the committed source. The endpoint and required \`data\` row fields are \`Date, Time, Code, O, H, L, C, Vo, Va\`; the start-of-minute timestamp is JST; response order is **not guaranteed**; \`pagination_key\` is an opaque continuation token; no-trade minutes are omitted; the 11:30 and 15:30 auction minute records may appear. The parser already sorts minute bars and treats post-09:05 rebound evidence only as hindsight.

Additional **read-only opt-in transport safety**:
- API request \`redirect:'error'\`: a redirected request **must not forward the \`x-api-key\` to another host**. Also set \`credentials:'omit'\`, \`referrerPolicy:'no-referrer'\`, and \`cache:'no-store'\`. This supplements but does not eliminate risks inherent to a trusted, secure runtime.
- Catch network/redirect exceptions and JSON parse failures with **constant redacted error codes** rather than forwarding arbitrary proxy/server text that might include secrets.
- Reject unexpected provider \`Date\` or five-character ordinary-share \`Code\` immediately, before requesting continuation pages.
- Bound total minute rows to **327** for a single TSE stock-day (09:00–11:30, 12:30–15:24, 15:30) as well as the already enforced maximum **four pages**. The response is invalid if it exceeds that scope.
- Check that the chosen historical day is **after the approximate 16:30 JST provider update** at both the user-facing plan and the direct HTTP helper level. 16:30 is only a scheduling guard and **not** proof that the provider has actually published a specific file.
- This does not create a server route or expose the key via browser. Only a separately authorized and isolated secure execution environment may run the explicit script. The connected Vercel plugin exposes the environment variable **names** but does not by itself provide a safe arbitrary code-execution capability with that secret. No API key has been decrypted or accessed.

**Verification:** \`tests/morningMinuteShadow.test.mjs\` 17 scenarios and \`tests/jquantsMinutePilot.test.mjs\` 20 scenarios = **37/37 passed** using exact current GitHub JavaScript source with mocked transport and a frozen-manifest crypto stub. **No native Node CI or actual authenticated minute API request** has been completed: the container cannot resolve the private GitHub remote, and the secure deployment runtime was not changed. No real return/edge/win-rate conclusion was drawn.


## Historical minute ↔ unadjusted daily OHLCV reconciliation (2026-11-01)

**Reason for this guard:** A fully paginated, individually plausible one-minute response can still omit an executed interval or a final auction. A 09:05 historical snapshot and a reconstructed rebound would then be based on an incomplete underlying price path. J-Quants supplies original daily O/H/L/C/Vo in a separate Standard-plan API; compare it with the minute archive **before** treating the source as structurally reconcilable.

New code:
- \`morningMinuteShadow.mjs\` now emits \`morning_minute_shadow_v2\` and a \`dailyObservation\` aggregating the **whole date** from correctly sequenced minute bars, including the first executed open, daily highest high, lowest low, last executed close, sum of volume and traded value. An empty minute archive has no invented O/H/L/C or volume.
- \`morningMinuteDailyReconciliation.mjs\` checks that the *same frozen symbol and original trade date* have valid minute v2 and provider daily v3 audits, with matching **unadjusted OHLCV**. Missing final auction/high/low, minute trade rows with a \`NO_TRADE\` daily record, nonzero daily volume with empty minutes, unresolved split/rights action, incomplete pagination, wrong versions or code/date mismatch **block historical quality clearance**. A correctly empty minute day and genuinely \`NO_TRADE\` daily record is reported as \`matchingNoTradeSession\`, **not** a qualified breakout/buy.
- \`jquants-minute-pilot.mjs\` remains dry-run by default. Optional \`--compare-daily\` requires the *same explicit \`--execute\` flag and secure backend approval* to call the Standard-plan \`/v2/equities/bars/daily\` **for that same one code and date**, in addition to the historical minute endpoint. Both providers have **at most 4 pages each**, so the optional combined plan has **8 HTTP requests maximum**; no loop over all frozen stocks/dates. The direct daily fetch helper independently verifies scope, publication cutoff, code/date, pagination, HTTPS endpoint, no redirects and redacted errors.
- Without \`--compare-daily\`, output status is \`MINUTE_ONLY_UNRECONCILED\` (never 'research ready'). With comparison, \`HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH\` means only the **one past code/day** had internally matching OHLCV. It does not mean market calendar, provider source-rights, data provenance, stock actions or historical 09:05 availability have been independently authenticated. All notification/trading flags remain false.
- Standard-day records also contain \`AdjFactor\` and \`ExRT\`; a nonunit adjustment or unresolved rights event blocks the comparison even if the OHLCV numerically matches. The provider's retroactively adjusted \`Adj*\` price fields must not replace original historical OHLCV.

**Zero-request default example:**

\`\`\`bash
node scripts/research/jquants-minute-pilot.mjs --code=3762 --date=2026-10-30 --compare-daily
\`\`\`

The dry-run does not require a key, does not retrieve API responses and does not create data.

**Explicit authorized read-only historical example (not executed in this PR):**

\`\`\`bash
node scripts/research/jquants-minute-pilot.mjs --execute --compare-daily --code=3762 --date=2026-10-30 --max-pages=4
\`\`\`

Run only in an already trusted runtime with \`JQUANTS_RESEARCH_PROBE_ENABLED=true\` and a secure existing \`JQUANTS_API_KEY\` environment variable. Do **not** paste or print the key. The release-time guard uses approximately 16:30 JST as a *minimum planning cutoff*, not proof the vendor actually published a given row. Each API may return fewer pages; if any pagination chain requires more than four, the output is incomplete and must not be used.

**Verification:** 58/58 targeted tests passed directly from GitHub-fetched JavaScript in an isolated V8 runner: 17 minute parser, 13 minute↔daily reconciliation and 28 bounded/mocked API tests. Frozen-manifest hashing and HTTP interfaces were stubbed by the test harness. Not a complete native Node.js CI, not a real vendor call, and not a backtested performance proof. No production changes or external API requests made.

Provider schemas: https://jpx-jquants.com/ja/spec/eq-bars-minute and https://jpx-jquants.com/ja/spec/eq-bars-daily .


## Fail-closed result presentation and exact share-volume matching (2026-11-01)

**Safety problem fixed:** The previous optional one-code/day pilot could output detailed \`asOf905\` and \`retrospective\` (bottom time and 1%/2% bounce) **even when \`--compare-daily\` was not selected or daily-vs-minute source integrity did not match**. Merely labeling the result \`MINUTE_ONLY_UNRECONCILED\` did not sufficiently prevent the user or later code from treating the visible percentages as trustworthy historical evidence.

**New output boundary:** \`summarizeMinutePilotResult\` now returns only an audit status, code/date, bar count and explicit error codes when the source is unverified. \`asOf905\` and \`retrospective\` are both **null until** an intact, same-code/day, complete minute audit is matched against an independent daily-bar audit, with no reconciliation blockers. Any wrong code/date, missing daily comparison, minute pagination gap, corporate-action review or volume mismatch withholds both metrics. A genuine correctly empty trading day is labeled \`MATCHED_NO_TRADE_NO_SIGNAL\`, not a buy/rebound event.

Only after a structural match are the hypothetical 09:00–09:04 observations and hindsight 09:00–09:59 outcomes printed. Such output remains **historical, retrospectively captured, not a true timestamp-verified quote from 09:05**, does not validate profitable trading or execution, and **never** changes production/scoring/notification eligibility.

**Volume exactness:** Share volume in the separate daily and summed-minute records is an original unit count; it must match **exactly**. The prior floating-point comparison had a 1e-8 relative tolerance for all values, inadvertently allowing a missing **one share at 500 million shares** to pass. Only price fields retain the strict relative tolerance needed for harmless floating serialization. New high-volume regression test fails the former false match.

**Verification:** The exact latest GitHub branch source was run in an isolated JavaScript/V8 test harness; 17 minute parser + 14 daily reconciliation + 36 mock-HTTP/CLI output tests = **67/67 passed**. The harness mocks the provider transport and frozen-manifest crypto. Native Node.js full-repository CI and an authenticated J-Quants API response are **not verified**. This is a correctness improvement to a **research-only Draft PR**, not a newly validated market advantage. No key reads, vendor API traffic, new charges, DB writes, cron, production merge/deploy, trade or push notification occurred.

The old command remains a no-network dry-run by default. Add \`--compare-daily\` with a separately authorized \`--execute\` in a secure backend runtime only when ready for the small historical test.


## Same-day provider-envelope and receipt-integrity gate (2026-11-01)

The previous minute↔daily reconciliation required OHLCV matching but did not independently check some contradictory metadata in the stored provider **daily** audit. For example, a record could claim \`rawProviderRows:0\` while containing two available stock-day bars, or a valid target stock-day could be accompanied by an unrecognized extra stock/date. This must fail closed: otherwise the pilot could report valid hindsight 1%-2% rebound figures from an internally inconsistent provider response.

Research-only \`app/lib/research/morningMinuteDailyReconciliation.mjs\` has been advanced to \`morning_minute_daily_reconciliation_v2\`. Before a \`structuralOneCodeDayMatched\` result, it additionally requires:

- Both minute and daily \`firstReceivedAt\`/\`lastReceivedAt\` to be syntactically valid, ordered, and no earlier than **16:30 JST** on the requested trade date. This is only a conservative readiness bound, **not proof of the official actual vendor release time or original historical market-time availability**.
- Daily \`counts\`, total \`rows\`, \`readPages\`, \`rawProviderRows\`, and \`structurallyUsableRawBars\` to reconcile. The number of provider rows may not be less than the directly observed bars, no-trade rows, corporate actions and invalid OHLCV rows.
- \`unmappedRows\`, \`outsideFrozenCodes\`, and \`duplicateCodeDates\` must be present and empty for an accepted **one-code/date scoped** API response. An unexpected code/date or duplicate cannot be ignored just because the target stock's prices happen to match.
- Minute \`observedRawBars\` must equal the dailyObservation bar count. Zero-minute summaries may not contain fabricated open/high/low/close, nonzero volume, or turnover. Nonempty reconstructed O/H/L/C must remain finite, positive and geometrically consistent.
- Exact original share-volume matching remains mandatory, along with original daily unadjusted O/H/L/C and no unresolved corporate actions. The 953-code frozen population remains fixed; a one-stock pilot does **not** certify completeness of all 953 symbols.

**New regression coverage:** Six malformed-data/receipt cases plus four actual parser-to-reconciliation cases were added. A regression first caught \`rawProviderRows:0\` falsely passing with observed stock-day rows; that hole was corrected before the final run. The current connected GitHub branch's **77/77 direct JavaScript V8 tests pass** (17 minute parser, 24 minute↔daily reconciliation including real daily parser outputs, 36 mock HTTP and result presentation). The test runner still mocks transport and frozen-manifest cryptography. A complete native Node.js GitHub Actions CI and **actual authenticated minute/day API requests have NOT been executed**.

This enforces research input integrity only. It does **not** validate an achievable market entry at 09:05, realized execution, transaction fees, forward win rate or a positive expected trading return; production and push notification flags remain disabled. No secrets accessed, new billing, provider calls, DB writes, scheduled fetch, production deploy or merge.


## Frozen 1-day source integrity and native Node research CI (2026-11-01)

An additional **fail-closed source-envelope check** is now in \`morningMinuteDailyReconciliation_v2\`. A valid-looking code/day OHLCV must be rejected if the underlying provider response claims an impossible \`rawProviderRows\` count, corrupt status counts, missing or duplicate source rows, wrong/out-of-frozen-class records, original receipt timestamps before **16:30 JST** or reversed receipts, or minute aggregates inconsistent with their own bar count or valid high/low geometry. The underlying historical daily provider may update around 16:30 JST, but this clock lower bound does **not** authenticate when the row truly became available.

A new regression found and fixed a real hole: \`rawProviderRows:0\` with existing source bars previously could pass through some reconciliation checks. Extra real-provider parser integration fixtures now verify foreign code/date, duplicated stock-day and purportedly too-early receipt are quarantined before any retrospective rebound metrics are released.

**Focused isolated V8 verification:** 77/77 passed after patching the real issue (17 minute source, 24 actual minute↔daily parser integration, 36 bounded/mock HTTP and fail-closed CLI presentation). This JavaScript-only harness uses a mock HTTP transport and a stub hash interface.

**Native Node.js execution route:** an existing \`.github/workflows/jquants-minute-pilot-offline.yml\` workflow (research branch only; \`ubuntu-latest\`, Node.js 22, **no environment secrets or HTTP API requests**) was expanded from two test modules to five:
- \`tests/jquantsMinutePilotHttp.test.mjs\`
- \`tests/jquantsMinutePilot.test.mjs\`
- \`tests/morningMinuteShadow.test.mjs\`
- \`tests/morningMinuteDailyReconciliation.test.mjs\`
- \`tests/ma75JQuantsDailyPages.test.mjs\`

A workflow conclusion is independently available under the PR's GitHub Actions checks. Test assertions use only synthetic source records and mocked provider transport; **even a successful native Node CI is not a live authenticated J-Quants API test, 09:05 availability proof, or real forward performance result**.

No source data collection, API key access, new billing, stock transaction, research DB write, production deployment, buy-signal promotion or push notification was performed by these changes.


## Fixed single-code response versus 953-code frozen universe (2026-11-01)

**Critical end-to-end blocker discovered:** \`fetchDailyPilotPages\` correctly makes an explicitly scoped \`code=3762&date=2026-10-30\` request. However, the previous \`main\` fed the one-stock response to \`parseMa75JQuantsDailyPages(freeze,{date,pages})\`, whose default scope is **every one of the original 953 frozen codes**. The resulting 952 \`MISSING_PROVIDER_ROW\` statuses prevented matching a valid one-stock day in \`reconcileMorningMinuteDaily\`. The pilot could never report an honest one-code daily↔minute match even if J-Quants returned the right source data. J-Quants' daily API officially supports exact \`code\` and \`date\` queries: https://jpx-jquants.com/ja/spec/eq-bars-daily .

**Fix without mutating or backfilling the frozen cohort:**
- \`parseMa75JQuantsDailyPages\` gained optional \`requestedCode\`, which **must already belong to the immutable original frozen population**. It derives a scoped one-stock code list without changing \`freeze.codes\`, sets \`auditScope: 'SINGLE_CODE_PILOT'\`, \`originalFrozenCohortSize:953\`, \`expectedFrozenCodes:1\`, \`requestedCode:3762\` and returns only the requested code's status. An unrequested or out-of-cohort code, duplicate source row, missing rights metadata, or mismatched date remains quarantined. Without \`requestedCode\`, all existing full-universe auditing continues to require the entire frozen set, with \`auditScope:'FROZEN_UNIVERSE'\`.
- \`reconcileMorningMinuteDaily\` now explicitly validates both **one-stock pilot** and **full-frozen-universe** audit scopes against the original freeze. A one-stock pilot can pass only if its code matches the requested code and its audit metadata still identifies the *original* 953-code cohort; **it does NOT certify full-universe historical coverage or real-world trading advantage**.
- The opt-in pilot CLI now calls \`analyzeHistoricalMinutePilotPages\`, a separately exported pure, no-network post-fetch analysis helper. Its exact code path calls the scoped daily parser, reconciles the requested stock/day, and releases hindsight outcomes **only if** structurally matched. This helper is the same one exercised by integration tests; no hypothetical 09:05 feed is claimed.
- New \`tests/morningMinuteSingleCodePilot.test.mjs\` loads the **real committed frozen 953-code JSON** and checks 12 cases, including a correct 3762 one-stock daily match; unchanged original frozen identity; rejection of non-frozen 3753, wrong code/date, duplicate/outside source rows, split/rights factor, missing executed minute, missing daily page and genuine no-trade day.

**Native verification:** the existing research-only GitHub Actions \`jquants-minute-pilot-offline.yml\` now runs **six** offline test files with Node.js 22. Actual job logs report **121 tests, 121 passed, 0 failed** at commit \`aef70e284e8553cd76624eafddae5823451d2ee3\`: https://github.com/asawaku1632/signal-x/actions/runs/41220251241/job/124593120351 . The CI uses only synthetic source data and mock providers; it does **not** test live J-Quants API entitlement, authentic source licensing, real historical minute-bar counts or forward P&L.

**Non-goals & safeguards:** No network call to J-Quants, private token access, new subscription/billing change, DB migration/write, production merge/deployment, live 09:05 stock signal, push notification or automatic trade was performed. The daily SMA75 analysis retains the full frozen 953-code denominator; the one-stock connectivity pilot is a distinct read-only experiment.


## One-day source coverage is not 76-session historical coverage (2026-11-01)

One additional ambiguity was found in the quality report: it previously set \`fullFrozenUniverseCovered=true\` when a **single date** had source records for every frozen symbol. That is not sufficient for the separate MA75 strategy, which requires **76 distinct, correctly dated and trading-calendar-verified historical sessions** before evaluating the prior/current 75-day moving-average crossover.

**Corrected semantics** in \`morningMinuteDailyReconciliation.mjs\` (\`morning_minute_daily_reconciliation_v3\`):
- \`frozenTradeDateRecordsComplete\` means every frozen symbol has an accepted original **DAILY_BAR or NO_TRADE row for this one date**, with the original frozen population, page envelope and metadata intact. A missing stock row, action review or malformed audit blocks that one-date completeness.
- \`fullFrozenUniverseCovered\` is retained as a fail-closed **false** compatibility value for any single-date pilot. It no longer implies that 76-day MA75 history was acquired.
- \`sessionDatesActuallyReconciled\` is **1 for a matched original OHLCV stock-day**, otherwise 0. \`requiredSessionDatesForMa75=76\`, \`frozen76SessionHistoryVerified=false\` and \`originalProviderEntitlementVerified=false\` are explicit and cannot become true merely because an API response has one valid stock/day.
- The optional CLI summary exposes these distinctions without printing hindsight rebound metrics when daily reconciliation was blocked. \`SINGLE_CODE_PILOT\` continues to preserve the original frozen 953-code identity without promoting itself into \`FROZEN_UNIVERSE\` coverage.
- Prior outputs using \`fullFrozenUniverseCovered=true\` for a single date must **not** be considered proof of complete 76-session data or of an independently repeatable market advantage.

**Verification:** \`jquants-minute-pilot-offline.yml\` on Node.js 22, six offline test modules and synthetic provider responses: **130/130 passed, zero failed**, from the latest GitHub Actions job at commit \`44481681e2da604be4193d6f35b3b2862914a98e\`. All code remains research-only; no provider HTTP call, API secret, new charge, production merge/deploy, DB modification, automated trading or push notification was involved. See https://github.com/asawaku1632/signal-x/actions/runs/41221339553/job/124596350369 .
