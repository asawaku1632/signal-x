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

## 2026-10-18 server-authenticated checkout issuance seam

Audited existing identity implementation:
- `app/lib/auth.ts` stores the stable `signalxUserId` in the signed NextAuth JWT after verified Google OAuth provider-subject resolution; `session.user.id` is populated from this server-side identity. E-mail alone is NOT an owner key.
- Special Google Play reviewer credentials deliberately remove `signalxUserId`. Such review sessions, and anonymous sessions, must never issue checkout tickets.
- `app/lib/push/requestSecurity.ts` shows the existing pattern for origin / host / Fetch Metadata / custom header browser request restrictions.

Added `app/lib/billing/playCheckoutSessionGate.ts`: accepts ONLY same-origin `POST` with explicit `Origin`, matching `Host`, `sec-fetch-site: same-origin`, JSON `{}` body and `x-signalx-request: play-checkout-issue-v1`. It rejects query parameters, cross-site requests, bearer tokens in lieu of the session, malformed payloads and caller-supplied `userId`, `productId`, price, callback, or redirect. The only identity is the server-issued NextAuth `session.user.id` UUID, and the ticket issuer checks the account's disabled state in PostgreSQL. A missing/malformed session is denied.

Added `app/lib/billing/playCheckoutNextAuthResearch.ts`: **server-only, explicitly disabled by default**, binds that guard to `getServerSession(authOptions)` and PostgreSQL. It creates NO public route, no checkout UI, no payments, and no production env settings. It requires `SIGNALX_RESEARCH_PLAY_CHECKOUT_ISSUE_ENABLED=true` plus a matching `NEXTAUTH_URL`; all products and HMAC keys come only from server env. Do not set this flag without a complete end-to-end threat review, browser/native channel, rate limits, CSRF review, credential management and approved database migration.

`tests/playCheckoutSessionGate.test.mjs` covers Google-session owner binding, unsigned fake/Play review sessions, site/host mismatch, CSRF barriers, rogue body fields, disabled feature, storage downtime and malformed requests. Disposable PostgreSQL tests also issue through this gate, ensuring stored ownership comes from the trusted session.

### TWA postMessage path: official option, NOT implemented

Chrome documents a bidirectional `postMessage` channel for Trusted Web Activities (supported starting Chrome 115). The Android app must establish its source-origin equivalence via Digital Asset Links `delegate_permission/common.use_as_origin` using the **actual Play App Signing SHA-256 certificate**, and the sender/receiver must validate the origin and channel. Signalx's currently checked-in TWA is only an Android Browser Helper launcher; it has no postMessage channel, no source-origin registration, and no native Play Billing integration. Browser fallback and unsupported Chrome versions need a safe **billing-unavailable** state, not an insecure alternate token handoff.

A proposed dedicated bridge would carry the raw single-use checkout ticket **only inside an origin-verified authenticated message channel**, never via App Link query, intent URI, analytics, logs, web URL/referrer, or persistent storage. The native receiver must pass it with a fresh integrity token whose request hash matches the server-issued ticket challenge; only the isolated server redeemer can consume it and return an opaque account identifier. PostMessage channel establishment is a separate engineering/Android signing task and cannot be represented as validated just because a message schema exists.

Official Chrome postMessage guidance: https://developer.chrome.com/docs/android/post-message-twa

**Production blockers remain:** No publicly reachable ticket issuance/redemption API route; no verified native postMessage bridge, Google Play service-account OAuth, actual Play Integrity API call or Play Billing purchase, updated signed APK, deployed DB migration, billing acknowledgment and renewal/cancellation pipeline, safe rate limiting, or Play Console activation.

## 2026-10-18: TWA postMessage strict research protocol (not enabled)

The Android Browser Helper launcher in `android-twa/app/src/main/` was **not modified**. No changes to `AndroidManifest.xml`, Gradle billing dependencies, APK/AAB, signing config, web pages, Play Console, or database. These files are isolated:

- `app/lib/billing/twaPostMessageBridgeResearch.ts`: shared Web-side typed protocol, strict JSON text frames, exact origin `https://signal-x-ppjg.vercel.app`, 128-bit per-channel nonce echo, readiness requirement, exactly one 256-bit ticket transfer, bounded 120s TTL. No network calls, checkout UI or listener by itself.
- `app/lib/billing/twaWebPortReceiverResearch.ts`: opt-in window `message` + transferred `MessagePort` receiver, immediately closed on navigation or protocol failure, and blocked unless explicitly enabled. **Not imported by production pages**. Same-origin `WindowProxy` senders are rejected when present; only the verified Android channel and server Play Integrity can provide robust caller assurance.
- `android-twa/research/TwaCheckoutMessagePolicy.java`: Android-side pure Java state machine. Only accepts **AndroidX `CustomTabsService.RELATION_USE_AS_ORIGIN = 1`** (not `RELATION_HANDLE_ALL_URLS = 2`), successful Digital Asset Links relationship callback for the **exact source origin**, an explicit postMessage channel-ready callback with exact source and target origins, random native HELLO nonce and matching ACK before READY. Accepts one valid, not-expired checkout ticket per channel. It does not itself create sessions, parse untrusted JSON, invoke Play Integrity or launch BillingClient.
- `tests/twaPostMessageBridgeResearch.test.mjs`, `tests/twaWebPortReceiverResearch.test.mjs` and `android-twa/research/ci-tests/TwaCheckoutMessagePolicyTest.java`: mock transport contract tests only.

Expected wire sequence: Android (after validated relation and channel ready) sends string JSON `{"type":"signalx.play.bridge.v1/hello","nonce":"<128-bit Base64URL>"}`; browser receives a `MessagePort`, validates exact sender origin, returns string JSON `hello-ack` with same nonce; Android confirms ACK on its verified browser session and sends string JSON `ready` over that session. **Only after explicit user action and an authenticated server-issued ticket** may Web send one string JSON `checkout-ticket` with the same nonce, the opaque ticket and expiration timestamp over the private port. Native validates and forwards to the existing trusted server redeem boundary, bound to a *fresh* Play Integrity request. No user ID, signing key, payment access, entitlement or provider token travels across the port.

Important: The Chrome official guide requires `delegate_permission/common.use_as_origin` in the site's **real** Digital Asset Links response with the **Play signing certificate** for `com.signalx.app`, explicit AndroidX `CustomTabsSession` warmup/relationship validation, constrained source/target origin, `PostMessageService`, and Chrome supporting TWA postMessage (Chrome 115+). These are NOT set up in the live app. In native integration, callbacks must be tied to the same exact `CustomTabsSession`, and navigation/background/binder disconnect must close the state machine. Android callback `onPostMessage(String)` requires a strict bounded JSON parser that rejects unknown fields: the pure policy deliberately operates on *already parsed* fields and is not evidence of a complete transport.

The optional browser adapter assumes a native-delivered `MessageEvent.source` that is `null`; this assumption **requires Play-installed device verification** because the guide does not promise it for every browser/provider. Do not relax sender-origin checks simply to make a failed browser path work. A message challenge/echo alone does NOT authenticate a SIGNALX member or prove that a genuine Play app initiated the request. If channel, origin equivalence, version, session identity or Play Integrity cannot be established, the safe result is **no purchase option**.

Official references:
- [Chrome for Developers: PostMessage for TWA](https://developer.chrome.com/docs/android/post-message-twa)
- [AndroidX CustomTabsService.RELATION_USE_AS_ORIGIN](https://developer.android.com/reference/androidx/browser/customtabs/CustomTabsService#RELATION_USE_AS_ORIGIN)
- [Android App Links/Digital Asset Links](https://developer.android.com/training/app-links/verify-android-applinks)

**Next gated steps:** real AndroidX & Chrome session integration, strict native JSON parsing, DAL with actual signing SHA-256, Play-licensed-device cross-browser testing, OAuth/setup checks, and a complete purchase/grant/ack/refund/recovery flow. None are implemented or authorized to ship by these research files.

## 2026-10-18: research adapter using actual AndroidX CustomTabsSession API signatures

- `android-twa/research/TwaAndroidXPostMessageResearch.java` now imports AndroidX `CustomTabsSession`, `CustomTabsCallback`, `CustomTabsService`, `android.net.Uri`, and `android.os.Bundle`. It is a **non-production** callback adapter: after the host has bound the browser service, called `CustomTabsClient.warmup(0)`, and created/attached the same launched session with this adapter's callback, it calls `session.validateRelationship(RELATION_USE_AS_ORIGIN, expectedOrigin, null)`. Merely submitting the call does not count as verification.
- On the browser's **successful** relationship callback for the exact SIGNALX origin and a matching navigation-finished event, the adapter calls `requestPostMessageChannel(sourceOrigin, targetOrigin, new Bundle())`. A positive return does not count as channel readiness; `onMessageChannelReady` must arrive before the adapter sends the per-channel HELLO.
- Incoming `onPostMessage` frames are accepted only in strict serialized JSON format. The adapter requires the matching HELLO ACK before sending READY, then accepts exactly one unexpired ticket and closes. Navigation, hidden tab, invalid relationship, malformed frame, wrong nonce, or AndroidX API failure all close without checkout.
- `android-twa/research/ci-stubs/` contains fake AndroidX and platform classes to run `TwaAndroidXPostMessageResearchTest.java` in Java 17 GitHub Actions. **Passing CI is a stubbed contract test, not evidence that this compiles against the real AndroidX artifact or works inside a signed TWA.** No production `LauncherActivity`, manifest, browser binding, signing or released Android artifact was changed.
- Chrome's TWA guide requires `androidx.browser.customtabs.PostMessageService` in the manifest, and a matching website Digital Asset Links entry with `delegate_permission/common.use_as_origin` for `com.signalx.app`, signed with the **actual Google Play App Signing certificate**.
- Inspected `public/.well-known/assetlinks.json`: it currently has a valid-format SHA-256 fingerprint and `delegate_permission/common.handle_all_urls`, but **no** `delegate_permission/common.use_as_origin`. The checked-in fingerprint is **not independently verified** against the Play signing certificate, and whether the site currently serves the checked-in contents was not verified. `scripts/audit-twa-postmessage-dal.mjs` reports these as blockers. This is a source audit only.
- Research-only templates `android-twa/research/postmessage-assetlinks.proposal.json` and `android-twa/research/postmessage-service.proposal.xml` show the prospective change without modifying any production manifest or `assetlinks.json`. The fingerprint placeholder **must not** be deployed. Only apply after reading Google Play Console's actual Play App Signing SHA-256, confirming the website host and exact distributed package.

Still missing: real Browser Helper LauncherActivity integration with the **same** launched CustomTabsSession, AndroidX browser dependency compatibility, UI lifecycle/service binding, Google Play signing-certificate confirmation, Digital Asset Links deployment, physical Play-installed Chrome 115+ testing, production OAuth credentials and verified Play Integrity, a consented purchase flow, backend acknowledgement/retry/RTDN, and owner approval for billing activation. A research adapter does not authorize a real paid purchase.

Official API references:
- https://developer.chrome.com/docs/android/post-message-twa
- https://developer.android.com/reference/androidx/browser/customtabs/CustomTabsSession
- https://developer.android.com/reference/androidx/browser/customtabs/CustomTabsService
- https://developer.android.com/reference/androidx/browser/customtabs/CustomTabsCallback

## 2026-10-18: Play signing SHA-256 match gate and REAL AndroidX compile

**Google Play App Signing certificate**, not a locally held upload-key certificate, must be used to identify the APK installed from Play. In the current Play Console UI, open the app, navigate **Protected with Play → Play Store distribution → Go to Play app signing**, then in the **App signing key** section copy the **SHA-256 certificate fingerprint**. Google may show multiple signing certificates for signing-key upgrades or quantum-ready delivery: verify every signing identity that may be delivered to users, rather than guessing from a local keystore. Official documentation: https://support.google.com/googleplay/android-developer/answer/9842756

Added `scripts/verify-play-signing-dal.mjs` and `tests/playSigningDalGate.test.mjs`. The script reads only `android-twa/twa-manifest.json` and the checked-in `public/.well-known/assetlinks.json`, verifies exact Android package/origin, validates fingerprint format and compares the **operator-supplied Play certificate SHA-256** to the existing site's app association. It only proposes adding `delegate_permission/common.use_as_origin` to an already-matching `handle_all_urls` declaration; it **never edits a file or deploys a website**, and it refuses to offer a proposal when the certificate does not match. Even a match is **not proof** that the live website serves the file or that the signed Play-installed app is trusted.

To check (manual, research only; fingerprint is public certificate information, not a private signing key):

```sh
SIGNALX_PLAY_APP_SIGNING_SHA256='PASTE_PLAY_CONSOLE_APP_SIGNING_SHA256' \
  node scripts/verify-play-signing-dal.mjs
```

Possible read-only results: `missing_or_invalid_play_signing_fingerprint`, `certificate_mismatch`, `missing_handle_all_urls_for_play_certificate`, `proposed_change_only`, or `source_relations_present`. None enables billing or TWA messaging. Do not commit or display passwords, keystore files, private keys, Google OAuth tokens or app signing secrets.

Also added a **separate unsigned Android library** at `android-twa/research/androidx-compile/`, compiled only by the `native-androidx-real-compile` GitHub Actions job using the real `androidx.browser:browser:1.9.0` library, Android 36 SDK and Gradle. This is intentionally distinct from the mock `native-play-contract` Java tests. It validates AndroidX method/type compatibility without including the current production `LauncherActivity`, generating a release APK/AAB, installing on a phone, publishing to Play, or enabling billing. A compile success alone does not verify session continuity with the Bubblewrap launcher or device runtime behavior.

**Go-live gates remain:** read the *actual* Play App Signing SHA-256; inspect website's **deployed** DAL and its HTTP content-type/HTTPS; verify the selected Play-installed Chrome/TWA session; add and test the origin relationship and PostMessageService only with an authorized, signed internal build; implement actual authenticated native ticket handoff, Play Integrity and purchase verification with release observability and rollback; obtain explicit owner approval before modifying published Android assets, production migrations, or paid access.

## 2026-10-18: real Google Play Billing Library 9.1.0 compile (isolated)

Official Google Play Billing Library release notes list **9.1.0 (2026-06-18)**: https://developer.android.com/google/play/billing/release-notes . This is the version selected for research compilation; future integration must recheck available releases and policy deadlines.

The isolated unsigned Android library at `android-twa/research/androidx-compile/` now resolves **both** real dependencies:
- `androidx.browser:browser:1.9.0`
- `com.android.billingclient:billing:9.1.0`

Its Gradle source set compiles `PlayCheckoutParamsFactory.java` alongside the research TWA postMessage classes using the real SDK, while the separate `native-play-contract` job continues to exercise deterministic Java stub behavior. CI now asserts the target `.class` files actually exist to detect an accidentally empty compile.

`PlayCheckoutParamsFactory.forSubscription` now requires its offer token to exactly match `ProductDetails.getSubscriptionOfferDetails().getOfferToken()` for the same fresh subscription product; missing, in-app-only, cross-product and unknown offers fail closed. Google Play remains the authority on eligibility and plan price at launch. This helper only builds native `BillingFlowParams` with a server-issued obfuscated user identifier. It **does not** connect to a live BillingClient, query products, launch checkout, accept a payment, grant PREMIUM or acknowledge/restore any subscription.

**Outstanding blockers before a real device checkout:** Play Console signing SHA-256 confirmation, matching production `use_as_origin` DAL relation and Android `PostMessageService` in a separately built signed app, installed TWA session verification, trusted handoff/Google Play Integrity actual API call, ProductDetails query from connected Play Store, secure session ownership, callback handling and backend acknowledgment/refunds. No APK/AAB is built and no production asset or payment switch is modified by this CI.

## 2026-10-18: owner-provided Play Console Digital Asset Links comparison

The owner supplied the **Play Console Digital Asset Links JSON** for `com.signalx.app`, which contains the public Play-distribution app signing SHA-256:

`C0:DF:8C:E9:18:EA:73:FA:A1:25:5A:0D:E4:7E:14:55:F8:8D:2B:8E:59:3A:56:4B:E0:34:B6:AE:56:4B:2E:D4`

The same Play Console screen separately listed the upload-key SHA-256:

`17:66:A9:A1:58:B0:FF:9A:1E:A0:AA:FE:22:12:0A:E9:60:DD:BF:4F:81:B4:0B:A4:A2:D9:26:93:E3:53:9D:79`

**Result:** The Google-generated Digital Asset Links app-signing fingerprint exactly matches the current repository source `public/.well-known/assetlinks.json`. The upload-key fingerprint does not match and must **not** replace it. Android package `com.signalx.app` and TWA origin `https://signal-x-ppjg.vercel.app` also agree with `android-twa/twa-manifest.json`.

**Next change prepared, but NOT applied to production:** The checked-in source currently declares only `delegate_permission/common.handle_all_urls`. The research proposal at `android-twa/research/postmessage-assetlinks.proposal.json` adds `delegate_permission/common.use_as_origin` to that same already matching statement, preserving package, certificate and existing relation unchanged. `tests/playConsoleSigningMatch.test.mjs` asserts exact fingerprint match, refuses upload-key substitution, and checks that the research proposal differs only by the added relation. No published `public/.well-known/assetlinks.json` change was made.

**Important remaining distinctions:** The evidence is a Play Console copy/paste plus local repository source; the live `https://signal-x-ppjg.vercel.app/.well-known/assetlinks.json` HTTPS response, Content-Type, Google Play-installed Android binary and Chrome `RELATION_USE_AS_ORIGIN` callback have NOT been verified by these tests. A source match is not equivalent to successful device trust verification. If Play Console has additional active signing certificates for key upgrades, verify all relevant identities before updating deployed DAL.

Production deployment of the new DAL relationship, a signed Android app with PostMessageService, Play Integrity access and purchases must remain gated behind explicit owner approval and end-to-end test checks.

## 2026-10-18: public production website observation + Android manifest rehearsal

After verifying the Play Console app-signing SHA-256, an external website-fetching attempt could not access the domain from this session. We therefore added a **read-only public HTTPS check executed by GitHub Actions**, `scripts/audit-live-play-dal.mjs`, plus deterministic tests `tests/livePlayDalAudit.test.mjs`. The check requires HTTP 200, a JSON Content-Type, a parseable Digital Asset Links array, Android package `com.signalx.app`, and the exact publicly supplied Play App Signing SHA-256. Redirect, HTML/login page, 401/403, unexpected certificate, missing URL association and missing `use_as_origin` are distinct outcomes; none is silently marked ready. This observation uses **no Vercel bypass token** or deployment changes.

GitHub Actions **Run #125** completed the `live-dal-observation` diagnostic and reported `"kind": "missing_use_as_origin"` for `https://signal-x-ppjg.vercel.app/.well-known/assetlinks.json`. That means the public website delivered JSON with the expected SIGNALX app ID, Google Play signing certificate and URL association, **but has not yet published the relationship needed for TWA postMessage**. This is a live observation at one point in time, not proof of an installed app's trust or successful paid checkout.

For the **Android side only**, `android-twa/research/androidx-compile/src/main/AndroidManifest.xml` now declares `androidx.browser.customtabs.PostMessageService` with `android:exported="true"`. It is a stand-alone unsigned research **library** project, not the actual Android app. CI runs Android Gradle Plugin's `processDebugManifest`, validates the generated manifest contains this service, and compiles the research AndroidX/Billing source against the actual SDKs. `tests/twaResearchManifest.test.mjs` confirms that the **public** `android-twa/app/src/main/AndroidManifest.xml` is still untouched and no real Play Billing dependency has been added to the published app's Gradle file.

**Important release order:** (1) safe isolated manifest rehearsal, (2) separately approved production-site DAL `use_as_origin` release with the matching signing certificate, (3) verify that exact published HTTPS JSON again, (4) separately authorized Android bundle integrating the SAME Bubblewrap-launched browser session and PostMessageService, (5) license-tester installed app verification and purchase/restore/ack/cancel/refund tests, (6) explicit approval to expose paid purchase options. Publishing the relation alone does not enable native bridge communication without an Android app update.

Nothing here merges the branch, changes `public/.well-known/assetlinks.json`, alters the published Android app, installs an APK, invokes a real purchase or modifies production DB. An informational CI success for `live-dal-observation` **does not mean** the website is ready; inspect its `kind` output.
