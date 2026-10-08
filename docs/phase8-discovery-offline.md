# Phase 8 DEV discovery: local implementation only

Real DEV execution remains unapproved. This change adds an independent manual
probe and offline mock tests; it does not change either existing Phase 8 adapter
or the Phase 7 runner. No evaluation period or source cutoff is selected.

## Capability boundary

- Only DEV project `jdtqwryiyxeuoraecorw`; production
  `paygtakajhvatwejygda` and every alternate destination are rejected before
  loading a database driver or constructing a client.
- Reuses `validateDestination`: exact direct host, port 5432, database/role
  `postgres`, verified TLS, default read-only transaction, UTC and ISO dates.
  Reuses the existing connection probe's actual socket/certificate observer.
- One connection attempt, no pooler/fallback/retry. Transaction is explicitly
  `REPEATABLE READ READ ONLY`; identity/isolation/read-only guards precede any
  observation-table query. Cleanup permits only ROLLBACK and client shutdown.
- Private fixed SELECT statements plus BEGIN/ROLLBACK. No user SQL, table,
  date-range or cutoff arguments; only fixed numeric limits are bound.
- No evaluator calls, market-data clients, value/return calculations, persistence,
  production consumers, notification, ranking, decision outputs, schedules or deploys.
- Failure returns only an allowlisted failure class, never partial coverage,
  credentials, URI, database error messages or raw metadata.

## Read population and output

All transaction-visible rows in the three BB observation tables are counted.
Bounded preflight counts reject oversized populations before full aggregation.
An orphan check prevents inner joins from silently hiding unrelated children.
Daily snapshots, events and results are aggregated separately before their daily
join, so multiple events/results cannot inflate snapshot or event counts.

The target predicate exactly matches Phase 8's daily Phase 7 provenance:
`1D / YAHOO_CHART / Asia/Tokyo / BB_OBSERVATION_V1 / shadowOnly=true /
phase="7" / PHASE_7_SHADOW_AUTOMATION`. JSON equality requires the exact JSON
boolean/string types, and COALESCE treats unknown/NULL as a non-match.

Output contains all/target date extrema, distinct observation-day counts and
snapshot counts. Daily output contains snapshot/symbol/event counts, target and
outside-or-unknown counts, created_at ranges for all three tables, bar_end_at and
evaluated_at ranges, result counts for horizons 1/3/5, evaluated-trade-date ranges
overall and per horizon, and independent result version/quality mismatch counts.
**Daily child availability and time ranges cover all provenance, not only target
scope.** Mixed data remains visible; this report does not certify evaluation scope.
Unexpected horizons fail aggregation validation rather than disappearing.

`DISCOVERY_STATUS=PASS` means acquisition, validation and cleanup succeeded.
`COVERAGE_STATUS` distinguishes `NO_DATA`, `NO_TARGET_SCOPE`, `MIXED_SCOPE`, and
`TARGET_SCOPE_ONLY`. None means evaluator-ready. Empty data retains null extrema.

The transaction timestamp is acquisition metadata. No source-cutoff predicate is
applied and no arguments are generated from extrema or this timestamp. Counts
do not certify historical completeness, calendar readiness, result validity or
absence of backfills. `created_at` is not a commit timestamp and immutable
historical row versions do not exist. Results are not revalidated against candles.

## Fixed resource caps

Connection 5 seconds; each statement 3 seconds; acquisition/validation 10 seconds;
shared cleanup grace at most 2 seconds, including rollback at most 1 second.
These bound asynchronous waits, not OS/process execution time. PostgreSQL
statement/query/idle-transaction timeouts are also set. Timeout, cancellation,
socket error or cleanup failure prevents a successful report.

Input population: at most 10,000 snapshots, 10,000 events, 30,000 results. Output:
at most 366 distinct dates, 1 MiB cumulative received row JSON and 1 MiB report
JSON including its newline. Limit+1 probes detect overflow without truncation.
Failure reports have a fixed, small schema. Limits may only be lowered through
the trusted test API; the CLI exposes no overrides. All-date scans and their
load limits still need approval before real execution; no indexes are created.

## Offline verification and future approval

Run only the mock suite locally:

```text
node --test tests/bollingerShadowDevDiscoveryPhase8.test.mjs
```

Mocks supply the destination, client, rows, clock, TLS observation and environment.
Socket attempts are trapped; fresh-import verification also forbids driver load
and database-environment reads. Registered V8 function-call breakpoints monitor
both evaluator functions without executing a positive control. Mock dates are synthetic, never approved
operational values. SQL text and acquisition contracts are tested; PostgreSQL
syntax, query plans, permissions and actual aggregates remain unverified.

The manual CLI accepts only `--confirm-dev` with the exact DEV project ref. It
reads only `TECHNICAL_BB_PHASE8_DEV_DATABASE_URL`; credentials never enter argv.
Do not invoke this CLI now. Separately approve the reviewed code, one manual DEV
connection, fixed SELECT/read population/load caps, and sanitized output handling
before any real discovery. Afterwards, review the report and separately approve
the three evaluation arguments and evaluator execution. No automatic next step.
