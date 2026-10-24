# SIGNALX — isolated Android bridge probe (negative-only test)

**CAUTION: this is NOT the SIGNALX Google Play app or a functioning paid checkout.** This is an isolated, separate-package debug app used to test Chrome 115+ Custom Tabs/TWA connection attempts and *safe refusal*.

## What it is
- Package/application ID: `com.signalx.bridgeprobe`, not `com.signalx.app`.
- Uses real AndroidX Browser 1.9.0, requires Chrome 115+, calls `CustomTabsClient.bindCustomTabsService` → `warmup` → `newSession` → `validateRelationship` → launches TWA **with that same session**.
- Forwards the session's callbacks to the research-only `TwaAndroidXPostMessageResearch` state machine. Displays only human-readable stage/deny reasons. Never logs raw tokens or frames.
- Configured with `PostMessageService` but **without Play Billing**, Play Integrity calls, a purchase button, a sign-in flow or network POSTs.
- The default GitHub Actions job produces a self-signed **debug APK**. Its distinct package/certificate identity is deliberately NOT in the site's DAL. Therefore `RELATION_USE_AS_ORIGIN` **must fail**, even though the website currently publishes the correct `com.signalx.app` Play-signing certificate. This negative result is correct and essential. Never mistake this probe for a successful native bridge integration.

## CI (repository-only)
GitHub Actions workflow `Premium Entitlement Isolated Checks` / job `internal-device-debug-probe` compiles and packages the probe with Java 17, Android SDK 36 and AndroidX Browser 1.9.0, then validates the APK's package ID and debug signature. The artifact is labeled `signalx-origin-probe-debug-unsafe-for-play` and is retained for 3 days. A successful build is **not** an Android device test.

## Optional tester check (debug app, manual)
1. Only on a test Android phone, install the APK from the workflow artifact after verifying it is from this branch and labeled **SIGNALX Bridge Probe**, not the Play store SIGNALX.
2. Ensure Google Chrome 115 or newer is installed and can open `https://signal-x-ppjg.vercel.app/`.
3. Open the probe and press **Chromeで通信検証を開始**.
4. When Chrome opens, use Android's back gesture/button to return to **SIGNALX Bridge Probe**, and look for **「DAL通信元チェック：拒否」**. This indicates expected fail-closed behavior. If the diagnostic stays on 「実行前」 or is missing, mark the test **unverified**, not passed.
5. If an unexpected browser DAL approval appears, the probe **closes its native channel before forwarding the approval**. If there is a crash, unexpected permission prompt, payment screen, or unexpected approval, **stop**; do not weaken the origin check. Do not uninstall the real Play app or enter credit-card data.

### Find the APK
1. Go to [Premium Entitlement Isolated Checks](https://github.com/asawaku1632/signal-x/actions/workflows/premium-entitlement-isolated-tests.yml).
2. Select a **completed successful** run from the research branch `research/premium-entitlements-isolated-20261018`.
3. Under **Artifacts**, download `signalx-origin-probe-debug-unsafe-for-play`; unzip and install the `app-debug.apk` on your own test Android device.
4. ADB alternative: `adb install app-debug.apk`. To launch use `adb shell monkey -p com.signalx.bridgeprobe 1`. The CI debug signature may differ between runs; if replacement fails, uninstall **only** `com.signalx.bridgeprobe` and install the new build. Leave `com.signalx.app` untouched.
5. You can uninstall this separate debug probe after testing; it never replaces the published SIGNALX.

The CI additionally rejects any APK whose signing SHA-256 equals the published Play App Signing fingerprint, or whose manifest requests the Google Play Billing permission. These checks are **not evidence of a successful payment or positive relationship**.

The probe launches the live SIGNALX site in a Chrome TWA-like window but does not modify or send orders, and it must never run billing. The site is a normal live site; avoid clicking trade actions while observing the probe.

## What would be needed for a positive trust test
A **separately authorized** `com.signalx.app` app bundle signed by the user's existing *upload key* and **distributed through Google Play internal testing**, so Google applies the actual Play **app signing key** that matches the site's `assetlinks.json`. This requires integrating a callback into the **same Bubblewrap-launched session**, provisioning the real PostMessageService, and adding a gated, non-purchase browser receive endpoint on the SAME origin. An ordinary Android Studio debug APK or this separate-package probe cannot satisfy that identity check. No keystore, signing password, Play Developer API credentials, release bundle or public-site changes are created by this PR.

**Never** remove the origin gate, whitelist a debug certificate on the production site to make a test pass, or promote the research branch to `main`. PostMessage readiness is not member authentication or Google Play Integrity attestation.
