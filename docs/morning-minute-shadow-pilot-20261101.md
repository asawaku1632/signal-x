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
