"use client";

import { useEffect, useState } from "react";

type PushState =
  | "checking"
  | "unsupported"
  | "not-configured"
  | "prompt"
  | "permitted"
  | "denied"
  | "subscribed"
  | "error";

const REQUEST_HEADERS = {
  "Content-Type": "application/json",
  "X-SIGNALX-Request": "push-ui",
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function pushSupported() {
  return window.isSecureContext
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export default function PushNotificationButton() {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("通知機能を確認しています…");
  const [busy, setBusy] = useState(false);
  const [renewSubscription, setRenewSubscription] = useState(false);

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!pushSupported()) {
        if (active) {
          setState("unsupported");
          setMessage("このブラウザではプッシュ通知を利用できません。");
        }
        return;
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (active) {
          setState("not-configured");
          setMessage("プッシュ通知はまだ設定されていません。");
        }
        return;
      }
      if (Notification.permission === "denied") {
        if (active) {
          setState("denied");
          setMessage("通知が拒否されています。ブラウザまたは端末の設定をご確認ください。");
        }
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!active) return;
      if (subscription) {
        const response = await fetch("/api/push/subscriptions/status", {
          method: "POST",
          headers: REQUEST_HEADERS,
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          cache: "no-store",
        });
        if (!active) return;
        if (!response.ok) throw new Error("Unable to check server registration");
        const result = await response.json() as { registered?: boolean };
        if (!active) return;
        if (result.registered) {
          setState("subscribed");
          setRenewSubscription(false);
          setMessage("サーバー登録は有効です。端末への通知表示は未確認です。");
        } else {
          setState("permitted");
          setRenewSubscription(true);
          setMessage("サーバーの通知登録が無効です。「登録を作り直す」を押してください。");
        }
      } else if (Notification.permission === "granted") {
        setState("permitted");
        setMessage("通知は許可済みです。購読を有効にしてください。");
      } else {
        setState("prompt");
        setMessage("ボタンを押したときだけ通知の許可を確認します。");
      }
    }
    void inspect().catch(() => {
      if (active) {
        setState("error");
        setMessage("通知状態を確認できませんでした。");
      }
    });
    return () => { active = false; };
  }, []);

  async function subscribe(forceNew = false) {
    setBusy(true);
    setMessage("通知を設定しています…");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey || !pushSupported()) throw new Error("Push is unavailable");
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("denied");
        setMessage("通知が拒否されました。設定は変更されていません。");
        return;
      }
      if (permission !== "granted") {
        setState("prompt");
        setMessage("通知はまだ許可されていません。");
        return;
      }

      const registration = await getRegistration();
      const previous = await registration.pushManager.getSubscription();
      if (forceNew && previous) await previous.unsubscribe();
      const subscription = (!forceNew ? previous : null)
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: REQUEST_HEADERS,
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Subscription save failed");
      setState("subscribed");
      setRenewSubscription(false);
      setMessage("新しい通知登録が保存されました。端末表示テストも確認してください。");
    } catch {
      setState("error");
      setMessage("通知の設定に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMessage("通知を解除しています…");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: REQUEST_HEADERS,
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Subscription removal failed");
        await subscription.unsubscribe();
      }
      setState(Notification.permission === "granted" ? "permitted" : "prompt");
      setRenewSubscription(false);
      setMessage("この端末のプッシュ通知を解除しました。");
    } catch {
      setState("error");
      setMessage("通知の解除に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function testDeviceDisplay() {
    setBusy(true);
    setMessage("端末内の表示テストを実行しています…");
    try {
      if (Notification.permission !== "granted") {
        setMessage("通知が許可されていません。Androidのアプリ通知設定をご確認ください。");
        return;
      }
      const registration = await getRegistration();
      await registration.showNotification("SIGNALX｜端末表示テスト", {
        body: "これが表示されれば、Androidへの通知表示は動作しています。",
        icon: "/icons/signalx-192.png",
        tag: "signalx-local-test-" + Date.now(),
      });
      setMessage("Androidに表示を依頼しました。通知が出なければ端末側またはTWAの通知連携を確認してください。");
    } catch {
      setMessage("端末内の通知表示に失敗しました。Android・Chromeの通知設定をご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("この端末へのテスト通知を送信しています…");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setState("permitted");
        setRenewSubscription(true);
        setMessage("この端末の通知登録が見つかりません。「登録を作り直す」を押してください。");
        return;
      }
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: REQUEST_HEADERS,
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = await response.json() as { sent?: number; error?: string; acceptedByPushService?: boolean };
      if (response.status === 404 || response.status === 410) {
        setState("permitted");
        setRenewSubscription(true);
        setMessage("この端末の通知登録が無効になりました。「登録を作り直す」を押してください。");
        return;
      }
      if (response.status === 429) {
        setMessage("送信制限中です。1分以上空けてからテストしてください。");
        return;
      }
      if (!response.ok || !result.acceptedByPushService) throw new Error("Test push failed");
      setState("subscribed");
      setMessage("通知サービスは送信を受け付けました（スマホ表示は未確認）。表示されなければ端末表示テストを実行してください。");
    } catch {
      setMessage("テスト送信に失敗しました。サーバー側の送信状況をご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = state === "checking" || state === "unsupported" || state === "not-configured" || state === "denied";

  return (
    <section className="mt-3 rounded-[22px] border border-blue-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900">🔔 プッシュ通知</h2>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
              state === "subscribed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}>
              {state === "subscribed" ? "登録済み" : state === "checking" ? "確認中" : "設定確認"}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500" aria-live="polite">{message}</p>
        </div>
        {state === "subscribed" ? (
          <button type="button" onClick={() => void sendTest()} disabled={busy}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
            テスト送信
          </button>
        ) : (
          <button type="button" onClick={() => void subscribe(renewSubscription)} disabled={unavailable || busy}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
            {renewSubscription ? "登録を作り直す" : "通知を有効に"}
          </button>
        )}
      </div>
      {state === "subscribed" && (
        <button type="button" onClick={() => void testDeviceDisplay()} disabled={busy}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 disabled:opacity-50">
          端末表示テスト（サーバーを使わずに表示）
        </button>
      )}
      {state === "subscribed" && (
        <details className="mt-2 border-t border-slate-100 pt-2">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-500">
            通知の解除・再設定
          </summary>
          <button type="button" onClick={() => void unsubscribe()} disabled={busy}
            className="mt-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-50">
            この端末の通知を解除
          </button>
        </details>
      )}
    </section>
  );
}
