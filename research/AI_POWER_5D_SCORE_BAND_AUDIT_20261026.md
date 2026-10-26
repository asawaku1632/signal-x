# AI POWER score-band five-trading-day audit (2026-10-26)

Source: user-provided aggregate JSON, not independently reproduced from database. Do not treat as verified trading performance.

| AI POWER | observed | matured | avg 5d % | positive % | severe loss % | worst 5d % |
|---|---:|---:|---:|---:|---:|---:|
| 00-19 | 2997 | 1667 | -0.815 | 49.31 | 17.94 | -20.8857 |
| 20-39 | 2694 | 1543 | -0.709 | 49.90 | 16.01 | -24.0757 |
| 40-54 | 1887 | 1164 | -0.883 | 49.05 | 17.18 | -20.6444 |
| 55-64 | 1081 | 629 | -0.216 | 53.58 | 14.31 | -21.8280 |
| 65-100 | 2741 | 1647 | -0.735 | 51.12 | 18.21 | -29.2740 |

Total observed 11400; matured 6650. Band 55-64 has the least-negative mean and lowest severe-loss frequency in these descriptive aggregates. Every band has a negative mean. Do not assume a monotonic score-to-return relationship.

## Validation gates before any ranking change

1. Confirm original SQL, source tables, timestamps, data-provider license, trading calendar and 5d return definition. Clarify severe loss threshold and price adjustment for splits/dividends.
2. Confirm 5d outcomes are truly matured and as-of safe, with no lookahead, survivorship or duplicate ticker-date observations. Separate missing and incomplete records.
3. Recompute per-day and per-symbol cohorts, confidence intervals and bootstrap uncertainty, and compare with an equal-weighted market benchmark and transaction costs.
4. Test out of sample by trading date; compare proposed calibration against the existing score, including severe loss rate and maximum drawdown. Avoid promoting the 55-64 band based on in-sample winner selection.
5. Keep production AI scoring, rankings, notifications and cron unchanged. Research only until independent validation and explicit approval.
