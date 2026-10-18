# SIGNALX / Android TWA Google Play Billing readiness (isolated audit)

Scope: GitHub source of `asawaku1632/signal-x`, reviewed 2026-10-18. **Audit only.** This document does not certify Play Console configuration, enable billing, invoke a real purchase, or deploy app code.

## Verified source facts

- Android app ID: `com.signalx.app` in `android-twa/twa-manifest.json`, `android-twa/app/build.gradle`, and `android-twa/app/src/main/AndroidManifest.xml`.
- App origin: `https://signal-x-ppjg.vercel.app`. Android package uses Bubblewrap/Trusted Web Activity, not a standalone native checkout.
- `android-twa/twa-manifest.json`: `features: {}`, `alphaDependencies.enabled: false`. Play Billing not enabled.
- `android-twa/app/build.gradle`: Android Browser Helper `2.6.2`; no separate Play Billing dependency/bridge in the inspected file.
- `android-twa/app/src/main/AndroidManifest.xml`: no Play Billing `PaymentService` entry.
- Default branch code search showed no `getDigitalGoodsService`, `PaymentRequest`, `androidpublisher`, or `purchaseToken` checkout call. PR #139 contains **isolated server-side helper modules only**, not production payment routes.
- Earlier isolated test fixtures incorrectly used `jp.signalx.app`. Tests were updated to use actual ID `com.signalx.app`, without modifying the package itself.
- `app/manifest.ts` declares a standard standalone web app; that does not establish that checkout works inside a Play-distributed TWA.

## Why checkout is still blocked

The isolated billing prototypes cannot currently be called end-to-end from the installed Android app. To integrate a TWA, Google's documented route uses Bubblewrap Play Billing support plus Digital Goods API / Payment Request in a trusted origin (subject to current browser/platform support); alternative native BillingClient integration is a materially different implementation. The exact approach **must** be selected and validated on the signed installed app; do not simply add a web Stripe button inside the Play-distributed TWA.

Also, isolated first-purchase registration intentionally requires provider-returned `obfuscatedExternalAccountId` matching server-issued account hash. The documented TWA Payment Request flow demonstrates a SKU and purchase token, but does **not establish** that the integration can set an `obfuscatedAccountId` in the provider purchase. Until such a trusted account-binding mechanism is demonstrated, **first-purchase enrollment is blocked**. Do not weaken ownership verification to work around missing native support.

The isolated server helpers are neither wired to authenticated production sessions nor provisioned with an Android Publisher OAuth service account. The Google Play Developer API must verify the purchase on the backend, subscription acknowledgement must happen, and refund/cancellation/RTDN synchronization must be designed before any user-visible billing feature is enabled.

## Gated deployment plan (none of these steps executed)

1. Confirm in Play Console: app ID `com.signalx.app`, merchant account, subscription product ID / base plan / testing track, testers, and Play-distributed APK/AAB signing. These are **unverified** from GitHub.
2. Confirm Digital Asset Links trust for the signing certificate actually installed from Play and the website origin. Do not infer trust from checked-in strings alone.
3. Decide the supported Android billing transport. For a TWA route, inspect supported Bubblewrap/Android Browser Helper integration, rebuild APK/AAB on an **isolated** branch and verify installed behavior; verify if it provides a server-reliable account-binding field. Do not change the existing Android package or production.
4. Add a **disabled-by-default** authenticated server API using server-kept OAuth credentials and secrets, never client-provided SIGNALX identity or client-reported paid status.
5. Design safe initial account attribution (without relying solely on a bearer purchase token), product/plan validation, subscription acknowledgement, pending purchase handling, and linked token migration.
6. Verify RTDN synchronization for refunds, revocations, renewals, holds, and expired subscriptions. Existing proof-of-concept event projection is **not** a production billing listener.
7. Complete isolated DB and CI security tests. Only then test using a registered Play **license tester** with test payment instrument; do not use a personal payment method. Test success, cancellation, pending, declined, restore, repeat submission, and multi-device flows.
8. Obtain owner approval before any production DB migration, new APK release, Play Console billing activation, merging PR #139, or enabling paid access.

## Source references (official)

- Chrome for Developers — [Receive Payments via Google Play Billing with Digital Goods API and Payment Request API](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- Android Developers — [Integrate Google Play with your server backend](https://developer.android.com/google/play/billing/backend)
- Android Developers — [Test your Google Play Billing Library integration](https://developer.android.com/google/play/billing/test)
- Google Play Console Help — [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

## Repeatable checks

Run `node scripts/audit-android-play-billing.mjs` to inspect the repository's known Android manifest, Gradle, TWA origin and fixture IDs. It reports `not_ready` by design while billing is disabled. No network or credentials are used.

Run `node --test tests/androidBillingReadiness.test.mjs` to protect package/origin identity and ensure an audit cannot accidentally be mistaken for active billing support. These tests are intentionally not evidence of a successful Google Play checkout.
