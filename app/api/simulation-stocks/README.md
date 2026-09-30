# Simulation stock feed

`GET /api/simulation-stocks` exposes the latest stored SIGNALX scan snapshot for the paper-trading screen. If the snapshot is missing, empty, or stale, it refreshes the full scan before returning stocks.
