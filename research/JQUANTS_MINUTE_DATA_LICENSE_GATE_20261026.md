# J-Quants minute-data licensing gate — 2026-10-26

## Confirmed from official JPX sources
- JPXI launched retail equity minute-bar/tick data on 2026-01-19.
- Minute/tick is a paid optional add-on for Light plan or above (announced price JPY 5,500/month incl. tax).
- Minute-bar data is updated daily, not real-time. It cannot replace live 09:05 quotes.
- J-Quants public FAQ prohibits sharing the raw acquired data and warns that repeatedly providing investment-analysis results to third parties using this data is prohibited.

Sources:
- https://www.jpx.co.jp/corporate/news/news-releases/6020/20260119.html
- https://jpx-jquants.com/ja/help/data
- https://jpx-jquants.com/apidoc.html

## Unverified — BLOCKING
- Whether this account actually subscribes to the minute/tick add-on.
- Whether the applicable plan permits automated retention of derived 09:05 metadata for private research.
- Whether any eventual SIGNALX commercial/third-party output derived from the data is authorized.
- Specific endpoint, coverage, timing and rate limits for the user's subscribed add-on.

## Implementation decision
- No activation, purchase, provider request, scheduled collection, or DB write.
- Keep offline fixture CI and development private table separate from production.
- Distinguish historical next-day validation from real-time 09:05 decisions.
- Seek explicit licensing confirmation from JPXI for the precise research, retention and onward-use cases before any collection.
- No inferred permission from possession of an API key or successful HTTP response.

## Practical next checks
1. Inspect J-Quants subscription dashboard for minute/tick add-on (without exposing API keys).
2. Request written clarification about private derived metadata storage and SIGNALX user-facing derived outputs.
3. If licensed, prototype on isolated dev only, with explicit operator approval and bounded retention.
