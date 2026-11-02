# MA75 wick/volume offline audit — 2026-11-02
Status: **SHADOW_NOT_APPROVED**. Source: read-only query of 130 `public.display_snapshots` daily chart entries with `dataSource=yahoo_chart`, using bars strictly earlier than Unix 1793577600. This is a convenience sample, NOT the complete TSE universe. Capture timestamps, corporate-action adjustments, full gap/chronology checks and fillability have NOT been independently audited.

Signal (prior-information-only): 75-day close SMA crosses upward, upper-wick fraction >=0.35, signal volume >=1.5x previous 20-day average. Entry assumed following session open +0.1%, exit session +5 close -0.1%; no execution proof.

| Code | Signal date | Wick % | Volume multiple | Cost /100 shares ¥ | 5-session hypothetical return % |
|---|---|---:|---:|---:|---:|
| 4401 | 2026-08-05 | 43.62 | 1.57 | 406806 | +15.885 |
| 5805 | 2026-08-10 | 38.78 | 2.31 | 270871 | +8.430 |
| 7775 | 2026-08-14 | 37.50 | 3.90 | 43443 | -2.039 |
| 6088 | 2026-09-08 | 40.00 | 1.73 | 55255 | +3.416 |
| 6264 | 2026-10-05 | 46.55 | 1.53 | 225025 | +0.999 |
| 7775 | 2026-10-09 | 48.15 | 8.40 | 42442 | PENDING / unavailable |
| 4187 | 2026-10-13 | 36.92 | 4.08 | 521521 | PENDING / unavailable |

Five observed outcomes: arithmetic mean +5.3382%, positive fraction 4/5 (80%). **Not predictive**: small sample, post-hoc selection, stale/missing outcome bars, chart selection bias. Do not present 80% as prospective win probability.

100-share lot budget ¥100k–¥500k: feasible lot ranges for observed outcomes are 4401 1–1; 5805 1–1; 7775 3–11; 6088 2–9; 6264 1–2. 4187 exceeds budget even at 100 shares. These are illustrative at hypothetical entry costs, not orders.

Before promotion: (1) verify historical acquisition as-of and bar adjustment; (2) run local Node tests/CI; (3) audit OHLCV chronology, extreme open/close gaps and flat bars; (4) validate actual execution assumptions; (5) obtain complete point-in-time market universe and untouched forward sample; (6) compare all baselines, regimes and multiple-testing corrections; (7) record risk, drawdown and turnover; (8) separate production approval.

No production changes, notifications, trading or additional services are authorized.

Gemini comparison set 6158, 5216, 4074, 3839: none has a matching `chart:<code>:1D` entry in the current 130 saved daily snapshots. Therefore the four cannot be classified from this source; absence is not a negative signal.

## Additional read-only quality audit (2026-11-02)
Across six codes 4187, 4401, 5805, 6088, 6264, 7775, inspected 731 stored bars (five codes with 122 each and 6264 with 121): invalid OHLCV 0, duplicate bar timestamps 0, flat high=low bars 0, >45% opening or closing gaps versus previous close 0. This is a basic series-level check, not proof of corporate-action adjustments, source timing, or fillability.
Missing outcomes are explained by stale saved charts: 7775 latest stored pre-Nov-2 bar is 2026-10-14, 4187 latest is 2026-10-15. Do not classify them as winners or losers. Refresh must be separately authorized and verified without extra cost; do not overwrite production data as part of this research.
