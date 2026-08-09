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
        setState("subscribed");
        setMessage("この端末はプッシュ通知を受け取れます。");
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

  async function subscribe() {
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
      const subscription = await registration.pushManager.getSubscription()
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
      setMessage("プッシュ通知を受け取る設定が完了しました。");
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
      setMessage("この端末のプッシュ通知を解除しました。");
    } catch {
      setState("error");
      setMessage("通知の解除に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("テスト通知を送信しています…");
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: REQUEST_HEADERS,
        body: "{}",
      });
      const result = await response.json() as { sent?: number; error?: string };
      if (!response.ok || !result.sent) {
        if (response.status === 429) throw new Error("RATE_LIMITED");
        throw new Error("Test push failed");
      }
      setState("subscribed");
      setMessage("テスト通知を送信しました。端末の通知をご確認ください。");
    } catch (error) {
      setState("subscribed");
      setMessage(error instanceof Error && error.message === "RATE_LIMITED"
        ? "連続送信はできません。1分ほど待ってからお試しください。"
        : "テスト通知の送信に失敗しました。設定をご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = state === "checking" || state === "unsupported" || state === "not-configured" || state === "denied";

  return (
    <section className="mt-5 rounded-[30px] border border-blue-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black tracking-[0.18em] text-blue-600">WEB PUSH</p>
      <h2 className="mt-1 text-xl font-black">プッシュ通知</h2>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500" aria-live="polite">
        {message}
      </p>

      <div className="mt-4 space-y-2">
        {state !== "subscribed" ? (
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={unavailable || busy}
            className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            通知を受け取る
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy}
              className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              テスト通知を送る
            </button>
            <button
              type="button"
              onClick={() => void unsubscribe()}
              disabled={busy}
              className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 disabled:opacity-50"
            >
              通知を解除する
            </button>
          </>
        )}
      </div>
    </section>
  );
}
