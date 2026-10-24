# SIGNALX production target

## Android / TWA

The Android app opens:

- Host: `signal-x-ppjg.vercel.app`
- Vercel project: `signal-x-ppjg`

There is also a separate Vercel project named `signal-x`. Do not use that project when diagnosing Android production traffic, chart requests, or Web Push navigation for the TWA.

Before any production rollback, promotion, log inspection, or deployment verification for Android, confirm that the selected Vercel project is `signal-x-ppjg`.

This was verified during the 2026-09-24 chart incident: `/api/chart/...` requests appeared in `signal-x-ppjg` logs, and promoting the known-good deployment there restored the Android chart.
