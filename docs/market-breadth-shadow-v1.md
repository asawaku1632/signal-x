# Market breadth shadow v1 (research-only)
- Draft PR only; migration is **not executed**.
- Inputs: licensed source, timestamp, trade date, Nikkei/TOPIX daily percent changes, advancers, decliners, unchanged.
- Fail closed on missing/unverified inputs; no fabricated history or Yahoo scraping.
- Provisional divergence: Nikkei positive, TOPIX nonpositive, declining share >=60%.
- Snapshot must be captured **as of** its own timestamp; never use future data to label earlier signals.
- Compare with SIGNALX forward results only using the **same trade date** and strictly later 5-TSE-session outcomes. Count unique symbols and dates; show sample size, mean, median, positive rate and market regime. Avoid look-ahead leakage.
- Before any production use: secure licensed breadth feed, owner-only API, isolated DB integration tests, timestamp/timezone checks, minimum sample and out-of-sample evaluation, CI green, manual approval.
- Never automatically change BUY/SELL, rankings, notifications, or live DB.
