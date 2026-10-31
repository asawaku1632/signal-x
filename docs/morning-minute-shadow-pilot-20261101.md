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
