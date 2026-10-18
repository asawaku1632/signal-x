/*
 * SIGNALX Android on-device Chrome Custom Tabs / TWA smoke-test.
 * This IS NOT the installed Google Play SIGNALX app. Its DEBUG signature and
 * package ID intentionally do not match the public website's Digital Asset
 * Links. Expected result: source-origin validation FAILS CLOSED.
 *
 * No token logging, production server calls, purchase launches or billing.
 * For a real successful origin relationship, use a Play-signed internal test
 * build of com.signalx.app with separately authorized Bubblewrap integration.
 */
package com.signalx.bridgeprobe;

import android.app.Activity;
import android.content.ComponentName;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.signalx.app.research.TwaAndroidXPostMessageResearch;
import java.security.SecureRandom;

public final class InternalBridgeProbeActivity extends Activity {
    private static final String CHROME_PACKAGE = "com.android.chrome";
    private static final Uri SIGNALX = Uri.parse("https://signal-x-ppjg.vercel.app/");
    private static final int CHROME_MIN_MAJOR = 115;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private TextView findings;
    private Button testButton;
    private CustomTabsServiceConnection connection;
    private TwaAndroidXPostMessageResearch bridge;
    private boolean binding;
    private boolean destroyed;
    private boolean testStarted;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(getResources().getDisplayMetrics().density * 18);
        root.setPadding(pad,pad,pad,pad);

        TextView title = new TextView(this);
        title.setText("SIGNALX 通信の内部検証");
        title.setTextSize(22);
        root.addView(title);

        TextView warning = new TextView(this);
        warning.setText("\nこれは正式なSIGNALXアプリではありません。\n"
            + "研究用の別アプリです。課金や会員登録は行いません。\n\n"
            + "重要：このアプリのパッケージと署名はGoogle Play配布版とは異なります。"
            + "よって、サイトの安全な通信許可（DAL）は失敗するのが正常です。\n"
            + "接続拒否を確認するためのテストです。\n");
        warning.setTextSize(15);
        root.addView(warning);

        testButton = new Button(this);
        testButton.setText("Chromeで通信検証を開始");
        root.addView(testButton);
        testButton.setOnClickListener((View v) -> startDiagnostic());

        findings = new TextView(this);
        findings.setTextSize(15);
        findings.setText("実行前：Google Play内部テスト版による通信成功は未検証");
        ScrollView scroll = new ScrollView(this);
        scroll.addView(findings);
        root.addView(scroll);
        setContentView(root);

        if (chromeMajorVersion() < CHROME_MIN_MAJOR) {
            report("Chrome 115以上が必要。テスト開始を停止。");
            testButton.setEnabled(false);
        }
    }

    private int chromeMajorVersion() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(CHROME_PACKAGE, 0);
            if (info.versionName == null) return -1;
            String[] parts = info.versionName.split("\\.");
            return Integer.parseInt(parts[0]);
        } catch (PackageManager.NameNotFoundException | NumberFormatException ex) {
            return -1;
        }
    }

    private void startDiagnostic() {
        if (destroyed || testStarted) return;
        testStarted = true;
        testButton.setEnabled(false);
        report("Chromeを確認。検証専用セッションを作成します。");

        bridge = new TwaAndroidXPostMessageResearch(
            true, new SecureRandom(),
            (opaqueTicket, expiresAt) -> {
                // No purchase is allowed in this probe, even if a malicious
                // page or compromised provider delivers something ticket-like.
                report("予期しない購入チケットを拒否しました。課金動作なし。");
                bridge.close();
            });

        final CustomTabsCallback secure = bridge.callback();
        final CustomTabsCallback observed = new CustomTabsCallback() {
            @Override
            public void onRelationshipValidationResult(
                int relation, Uri origin, boolean accepted, Bundle extras) {
                secure.onRelationshipValidationResult(relation,origin,accepted,extras);
                if (accepted && relation == CustomTabsService.RELATION_USE_AS_ORIGIN
                    && SIGNALX.toString().startsWith(origin==null?"?":origin.toString())) {
                    report("DAL通信元チェック：成功。ただしPlay配布版かは別途確認。");
                } else {
                    report("DAL通信元チェック：拒否（このデバッグアプリでは想定どおり）。");
                }
            }
            @Override
            public void onNavigationEvent(int event, Bundle extras) {
                secure.onNavigationEvent(event, extras);
                if (event == NAVIGATION_FINISHED) {
                    report("Chrome画面の読込み完了。通信許可を待ちます。");
                }
            }
            @Override
            public void onMessageChannelReady(Bundle extras) {
                secure.onMessageChannelReady(extras);
                report(bridge.isClosed()
                    ? "通信チャネル準備：拒否"
                    : "通信チャネル準備：Androidで初回メッセージ送信を試行");
            }
            @Override
            public void onPostMessage(String raw, Bundle extras) {
                // Do not print, store, or log raw messages or checkout tokens.
                secure.onPostMessage(raw, extras);
                report(bridge.isClosed()
                    ? "受信データ：規則違反で通信を終了"
                    : "受信データ：処理済み（内容は非表示）");
            }
        };

        connection = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(
                ComponentName component, CustomTabsClient client) {
                if (destroyed || client == null || bridge == null) return;
                if (!CHROME_PACKAGE.equals(component.getPackageName())) {
                    report("Chrome以外に接続したため拒否");
                    bridge.close();
                    return;
                }
                if (!client.warmup(0L)) {
                    report("Chrome warmupに失敗。停止");
                    bridge.close();
                    return;
                }
                CustomTabsSession session = client.newSession(observed);
                if (session == null || !bridge.attachAfterWarmup(session)) {
                    report("検証開始セッションの作成に失敗。停止");
                    bridge.close();
                    return;
                }
                report("同じCustomTabsSessionで検証要求・TWA起動を試します。");
                try {
                    new TrustedWebActivityIntentBuilder(SIGNALX)
                        .build(session).launchTrustedWebActivity(InternalBridgeProbeActivity.this);
                } catch (RuntimeException error) {
                    // No exception message: may contain intent or URL context.
                    report("TWAを起動できません。通信は閉じます。");
                    bridge.close();
                }
            }

            @Override
            public void onServiceDisconnected(ComponentName component) {
                report("Chrome接続切断。検証を終了。");
                if (bridge != null) bridge.close();
            }
        };
        try {
            binding = CustomTabsClient.bindCustomTabsService(this,CHROME_PACKAGE,connection);
            if (!binding) {
                report("Chromeサービスに接続できません。");
                bridge.close();
            }
        } catch (RuntimeException ex) {
            report("Chromeサービスへの接続要求に失敗。");
            bridge.close();
        }
    }

    private void report(String state) {
        ui.post(() -> {
            if (!destroyed && findings != null) {
                findings.append("\n• " + state);
            }
        });
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        if (bridge != null) bridge.close();
        if (binding && connection != null) {
            try { unbindService(connection); }
            catch (RuntimeException ignored) { /* test already stopped */ }
        }
        super.onDestroy();
    }
}
