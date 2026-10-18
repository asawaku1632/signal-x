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

## 2026-10-18 additional official API review: acknowledgement and attribution

The TWA Digital Goods + Payment Request example sends a SKU and returns a purchase token, but Google's guide expressly says these web APIs do not know the app's user identity. Nothing in that guide demonstrates client-provided `setObfuscatedAccountId` for TWA checkout. By contrast, **native BillingClient** supports `BillingFlowParams.Builder.setObfuscatedAccountId`, and the Play `subscriptionsv2.get` response can carry `externalAccountIdentifiers.obfuscatedExternalAccountId`.

The Google Play Developer API `purchases.subscriptions.acknowledge` also accepts optional `externalAccountIds.obfuscatedAccountId` in its **server-side acknowledgment request**. However, placing a user-provided ID there *after* payment does **not** prove who initiated a purchase, and the purchase token alone is a bearer credential. Do not reinterpret that field as independent ownership proof. We still need a validated, safe transaction-specific attribution mechanism before enabling a TWA-only checkout or claiming first-purchase identity verification.

Initial subscription purchases, plan changes and re-signups that create new purchase tokens need acknowledgement. The `subscriptionsv2.get` response includes `acknowledgementState` (PENDING / ACKNOWLEDGED); the actual acknowledgement endpoint is `purchases.subscriptions.acknowledge`. Unknown state, pending payment, mismatched owner, invalid product, revoked or uncommitted entitlement must **not** be acknowledged. Google recommends acknowledging after verifying and granting entitlements; failure to acknowledge in the allowed window can lead to refund and revocation. A durable, retryable acknowledgement workflow and handling for failure/revocation are required **before production**.

Added isolated policy `app/lib/billing/playAcknowledgementPolicy.ts` and unit tests to encode these restrictions. This is a pure decision helper, **not a live acknowledgment API call** and not a retrying queue.

Official references:
- https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
- https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.Builder
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge
- https://developer.android.com/google/play/billing/integrate

## 2026-10-18 isolated Android account-attribution prototype (not wired)

**Implementation choice for research:** test a Native BillingClient purchase flow that calls `BillingFlowParams.Builder.setObfuscatedAccountId()`. Google documents that field as a privacy-preserving account identifier (max 64 characters); purchases.subscriptionsv2.get can return it as `externalAccountIdentifiers.obfuscatedExternalAccountId` if specified at purchase time.

The following Java file is **deliberately outside** `android-twa/app/src/main/`: `android-twa/research/PlayCheckoutParamsFactory.java`. It requires a server-issued 64-hex account HMAC, the expected subscription product ID and a currently eligible offer token from Play's own ProductDetails query. It rejects absent/wrong data, then builds native BillingFlowParams. This file neither launches billing nor exposes a JS bridge.

A separate CI job named `native-play-contract` compiles this prototype with **local test stubs**, not the real Google Play Billing SDK. It only checks syntax and mocked parameter propagation. This is not an Android APK build, not a Play Billing integration test, and not proof of a real purchase.

### Proposed secure origin-to-native handoff (not yet implemented)

1. Browser-side logged-in SIGNALX member selects a paid subscription on the verified SIGNALX origin. Server authenticates the NextAuth session; browser-supplied user IDs are ignored.
2. Server issues a short-lived **single-use** checkout handoff ticket tied to the authenticated SIGNALX UUID, intended Android package `com.signalx.app`, product and server-side nonce; it never supplies an HMAC key, Google OAuth token or raw email.
3. Android receives the ticket through a **separately reviewed, origin-verified native handoff**. TWA does not automatically give its web content the power to call arbitrary Java methods. HTTPS/App Links origin validation, authenticated redemption, one-time consumption, replay rejection and cross-account checks are required. A loose `intent://` or exported unverified URL handler is unsafe.
4. Native app redeems the ticket with the backend and receives only the opaque 64-character `obfuscatedAccountId` bound to that checkout. The server must reject expired/reused tickets, revoked sessions and package/product mismatches. **The native app never generates a new account HMAC from a client-provided UUID.**
5. Native BillingClient uses queried Play ProductDetails and an eligible subscription offer token; the isolated `PlayCheckoutParamsFactory` demonstrates setting the verified account ID on the purchase parameters. The actual Android BillingClient initialization, product query, UI, callbacks, purchase restoration and activity wiring are **not implemented**.
6. Following a purchase callback, Android sends only a purchase token to a protected backend request. Server calls Google Play Developer API, checks actual `com.signalx.app`, subscribed product, state, expiry and the `obfuscatedExternalAccountId` corresponding to the authenticated user, then atomically inserts binding and entitlement and acknowledges via a durable retry mechanism. Client-side `PURCHASED` flags alone never grant access.
7. For web-only and unsupported TWA browsers, keep billing disabled and offer a non-transactional informational state. Never fall back to accepting possession of a raw token as sufficient to claim an account.

### Blockers before any real payments

- Confirm that an origin-verified user-to-native handoff actually works on a signed TWA installed from the Google Play track. No supported handoff has been implemented or verified yet.
- Compile against the current **real** Play Billing Library (the Java stubs are not that SDK), safely initialize client, and test on physical Play license-tester devices.
- Confirm merchant setup, product IDs, base plans, offer tokens, digital asset links and Android Publisher OAuth access from Play Console. Do not assume any of these exist.
- Complete authenticated session routes, single-use nonce storage, entitlement synchronization, acknowledgement retries, RTDN, refunds/holds/cancellations, and account recovery.
- Review Play policy and business requirements for both the Play-distributed app and the open-web site before offering payment UI.
- Only after owner approval: Android rebuild, Play test deployment, migration, merging or billing activation.

References: [Google BillingFlowParams.Builder](https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.Builder), [ProductDetailsParams.Builder](https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.Builder), [Google Play purchase V2 externalAccountIdentifiers](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2), [Google Play Billing integration](https://developer.android.com/google/play/billing/integrate).

## 2026-10-18 isolated, single-use Web-to-native checkout ticket

New research-only files:
- `scripts/migrations/20261018_create_play_checkout_tickets_isolated.sql` (proposal, **not applied**).
- `app/lib/billing/playCheckoutTicketResearch.ts` (server-side policy and atomic storage, **not an API route**).
- `tests/playCheckoutTicketResearch.test.mjs` and disposable PostgreSQL integration tests.

The trusted website/backend issues a cryptographically random 32-byte URL-safe ticket **only after the server has authenticated the logged-in member**. Only a keyed HMAC digest is stored in a locked-down PostgreSQL table with that user's stable UUID, the hard-coded Android package `com.signalx.app`, the server-allowed subscription SKU, issue time, and a maximum 120-second expiry. The raw ticket must never be placed in an ordinary query string, analytics event, HTTP access log, error log, referrer or push notification. The code deliberately does not implement a deep-link transport: **a safe TWA-to-native handoff is still unresolved**.

Before the ticket may be redeemed, the backend must decode a **fresh Google Play Integrity token using Google's server-side decode API** (not a JSON object supplied by the client) and check all of: standard request hash bound to the ticket digest, expected package, timestamp freshness, `PLAY_RECOGNIZED`, and a certificate digest in a server-configured allowlist based on the **Play signing certificate**. The function accepts an injected trusted decoder for unit tests only; there is **no production Google API decoder** yet, and an untrusted caller must never choose this decoder.

A single conditional SQL `UPDATE ... RETURNING` atomically consumes the ticket only if unexpired, unconsumed, matching SKU/package and with a currently enabled SIGNALX user. On success, the server returns only the HMAC-derived obfuscated account ID and SKU for the native `BillingFlowParams` prototype. This **does not grant premium access, start a purchase or acknowledge payment**. Explicit checks for attestation failure, expired/replayed tickets, account disablement, certificate mismatch, and two concurrent redeemers are in CI. No secrets are committed.

Remaining mandatory safety gates:
- Confirm the installed, Play-distributed TWA can receive an authenticated ticket via an origin-verified secure native bridge without exposing it to untrusted apps. Android App Links verification is useful but not sufficient as a backend caller attestation.
- Provision and test actual Google Play Integrity decode credentials, signed app package/certificate allowlist, token freshness, and operational failure handling. Fail closed on API downtime.
- Wire issuance exclusively to a NextAuth-authenticated server route with CSRF protection and strict authorization, throttling, and abuse logging that never records raw tickets. The current function trusts its server-side caller to provide the verified UUID.
- Link the native purchase callback to server-side Developer API verification and atomic enrollment **after** purchase; finish durable acknowledgment/RTDN and refund handling.
- Define ticket storage retention, HMAC key rotation, product allowlisting, and identity-switch recovery before production.
- No migration, merging, Play Console activation, APK rebuild or real purchase without owner approval.

Official security references: [Play Integrity verdicts](https://developer.android.com/google/play/integrity/verdicts), [Android App Links](https://developer.android.com/training/app-links/about), [Android Play Billing](https://developer.android.com/google/play/billing/integrate).

## 2026-10-18 Play Integrity server decoder contract (isolated)

Created `app/lib/billing/googlePlayIntegrityDecoder.ts` and `tests/googlePlayIntegrityDecoder.test.mjs`. The adapter implements the official Google server-side REST call `POST https://playintegrity.googleapis.com/v1/com.signalx.app:decodeIntegrityToken`, submitting `{"integrityToken":"..."}` and a **server-held** bearer token with `https://www.googleapis.com/auth/playintegrity` scope. Credentials and HTTP transport are injected **server side**; this adapter does not generate service-account OAuth tokens, configure Google Cloud, or expose an endpoint.

Only an HTTP 200 with the Google wrapper `tokenPayloadExternal` and parseable `requestDetails` / `appIntegrity` becomes a decoder result. Missing payload, malformed timestamp/hash, invalid cert arrays, 403s, 5xx, network error and malformed JSON all fail closed with `null`; neither bearer nor integrity token is logged. This intentionally rejects classic `nonce`-only payloads because SIGNALX prototypes use Play Integrity **standard** `requestHash` request binding.

Decoded data is **not** independently a proof of a SIGNALX user's entitlement. `redeemPlayCheckoutTicketResearch` must still verify the request-specific hash (bound to the stored ticket digest, package, and product), freshness, `PLAY_RECOGNIZED`, Play signing-certificate digest allowlist, and the ticket's DB-level atomic one-time claim. A disposable PostgreSQL test exercises this composition with **mocked Google HTTP only**, including replay and wrong-hash denial.

Official API references:
- [Standard Play Integrity server-side decoding](https://developer.android.com/google/play/integrity/standard)
- [Play Integrity v1 API discovery schema](https://developers.google.com/android-publisher/api-ref/rest/v3) (distinct from Android Publisher; use Play Integrity REST endpoint noted above)
- [Play Integrity response verdict interpretation](https://developer.android.com/google/play/integrity/verdicts)

**Still blocked:** no real Google Cloud service account, Play Integrity API activation, trusted authenticated NextAuth route, Android-to-web handoff, actual Java SDK, AAB build, physical device test, production database migration, or Google Play billing activation. The injected fake HTTP implementation in CI is **not** a real Google verification call.
