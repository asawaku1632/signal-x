# J-Quants historical reference comparison — research runbook

**Status:** Offline comparator tests are not a live provider verification. This workflow must never be interpreted as trading guidance or a claim of independent validation.

## Scope and safety

- Branch: `research/jquants-independent-compare-20261022`; draft PR #202. Keep this work isolated; do not merge or deploy to Production as part of this investigation.
- Endpoint: `/api/admin/research/jquants-reference-compare` (GET). Requires an authenticated admin session, `VERCEL_ENV=preview`, `JQUANTS_RESEARCH_PROBE_ENABLED=true`, and a server-side `JQUANTS_API_KEY`.
- The endpoint requests only `39960` for `2026-07-01` from J-Quants API v2, compares O/H/L/C/Vo to a manually recorded reference, and returns status **without returning raw prices or credentials**.
- The endpoint does not write to the database, place orders, change notifications, or publish any return figures. Do not put credentials into GitHub Actions, browser query strings, screenshots, chat, or logs.

## Before running a live comparison

1. Confirm the Vercel deployment is the **Preview** for the exact research branch/commit, not Production. Verify project ownership and URL from the Vercel dashboard; do not infer it from a similarly named deployment.
2. Confirm Preview-only environment configuration in Vercel UI. Set the feature flag only if the operator intends to perform the test and is authorized to use the API key; do not expose the key in client code.
3. Open the endpoint **while logged in as the administrator** on the verified Preview domain. If Preview is protected by deployment authentication, authenticate normally. Do not bypass access controls.
4. Record only the non-secret JSON status, the deployment commit, and the date of the observation. No raw upstream provider response or API key is needed.
5. After testing, disable the Preview probe flag if it is not needed.

## Interpretation

| Status | Interpretation | Next action |
| --- | --- | --- |
| `REFERENCE_MATCH` | The fetched row equals the **manually recorded** reference for all five fields | Record provisional fixture match only; independent validation remains false |
| `REFERENCE_MISMATCH` | At least one of the five values differs | Review corporate actions, adjusted vs unadjusted bars, data definitions, and original reference |
| `FIELDS_MISSING` | A required field is absent or nonnumeric | Review the API v2 response schema without disclosing the payload |
| `WRONG_BAR` | Code/date do not match the fixed request | Investigate response selection and API code format |
| `INVALID_RESPONSE` | Ambiguous or malformed provider response | Do not infer prices or pass validation |
| `ADMIN_REQUIRED`, `PROBE_DISABLED`, `KEY_NOT_CONFIGURED` | Required access/configuration not available | Stop; do not weaken the guard |
| `AUTH_OR_ENTITLEMENT_REJECTED`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `NETWORK_OR_PARSE_ERROR` | Provider/network failure | Stop and investigate authorization or service availability without logging secrets |

A match is **not** independent-provider verification, evidence of permission to redistribute prices, or evidence of predictive performance. The response intentionally retains `independentlyCompared: false`, `priceVerified: false`, and `publishableReturn: false`.

## Reproducible offline checks

The established GitHub pull-request workflow executes `tests/jQuantsHistoricalProbe.test.mjs`, which imports both standalone comparator test modules. Inspect the Actions log's total/pass/fail counts and ensure Next.js type generation and TypeScript checks also pass. These are **offline tests only** and do not make a live J-Quants request.

## Blocker

When the connected Vercel integration cannot resolve the actual SIGNALX project/deployment, stop rather than guess a URL, request repeated OAuth authorizations, or target Production. The operator can later use the authenticated Vercel dashboard to obtain the correct Preview URL. No API key should be shared in chat.
