"use client";

import { useEffect, useState } from "react";
import PriceTargetControls from "./PriceTargetControls";
import NotificationResearchProgress from "./NotificationResearchProgress";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  type NotificationPreferences,
} from "@/app/lib/push/notificationTypes";

const HEADERS = { "Content-Type": "application/json", "X-SIGNALX-Request": "push-ui" };

export default function NotificationCustomization() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "research">("settings");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/push/preferences", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Preferences read failed");
        const data = await response.json() as { preferences?: NotificationPreferences };
        if (!data.preferences) throw new Error("Preferences missing");
        setPreferences(data.preferences);
        setMessage("");
      } catch {
        if (!controller.signal.aborted) setMessage("通知設定を取得できませんでした。画面を更新してお試しください。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("設定を保存しています…");
    try {
      const response = await fetch("/api/push/preferences", {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify({ preferences }),
      });
      if (!response.ok) throw new Error("Save failed");
      setDirty(false);
      setMessage("通知の種類を保存しました。LINEの設定は変更していません。");
    } catch {
      setMessage("設定を保存できませんでした。少し待って再度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  const selected = Object.values(preferences).filter(Boolean).length;

  return (
    <section id="notification-customization" className="mt-3 scroll-mt-4 rounded-[24px] border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black tracking-[0.18em] text-blue-600">NOTIFICATION SETTINGS</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h2 className="text-xl font-black">通知カスタマイズ</h2>
        <span className="text-xs font-bold text-slate-500">{selected}/9 選択</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="通知と研究の切り替え">
        <button type="button" id="push-settings-tab" role="tab"
          aria-selected={activeTab === "settings"} aria-controls="push-settings-panel"
          onClick={() => setActiveTab("settings")}
          className={`rounded-xl px-3 py-3 text-sm font-black transition-colors ${activeTab === "settings"
            ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"}`}>
          🔔 通知設定
        </button>
        <button type="button" id="push-research-tab" role="tab"
          aria-selected={activeTab === "research"} aria-controls="push-research-panel"
          onClick={() => setActiveTab("research")}
          className={`rounded-xl px-3 py-3 text-sm font-black transition-colors ${activeTab === "research"
            ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"}`}>
          📊 研究成績
        </button>
      </div>
      {activeTab === "settings" ? (
      <div id="push-settings-panel" role="tabpanel" aria-labelledby="push-settings-tab">
        <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
          スマホのプッシュ通知だけを変更できます。現在届いているLINE通知はこれまでどおりです。
        </p>
      <div className="mt-4 divide-y divide-slate-100">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <label key={category.key} className="flex cursor-pointer items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-800">{category.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{category.description}</span>
              {!category.available && (
                <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  研究検証待ち・配信は停止中
                </span>
              )}
            </div>
            <input type="checkbox" checked={preferences[category.key]} disabled={loading || saving}
              onChange={(event) => {
                setPreferences((previous) => ({ ...previous, [category.key]: event.target.checked }));
                setDirty(true);
                setMessage("");
              }}
              className="h-6 w-6 shrink-0 accent-blue-600"
              aria-label={category.title + "を受け取る"}
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={() => void save()} disabled={loading || saving || !dirty}
        className="mt-4 w-full rounded-full bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">
        {saving ? "保存中…" : "通知の設定を保存"}
      </button>
      {message && <p role="status" className="mt-3 text-xs font-bold leading-5 text-slate-600">{message}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        研究中の4種類はONにしても検証条件を満たすまで通知しません。
        対象の予測が検証済みになり、配信機能が有効化された場合のみ通知対象となります。
      </p>
      <PriceTargetControls enabled={preferences.price_target && !dirty} />
      </div>
      ) : (
        <div id="push-research-panel" role="tabpanel" aria-labelledby="push-research-tab">
          {dirty && <p className="mt-3 text-xs font-bold text-amber-700">
            通知設定に未保存の変更があります。通知設定タブで保存してね。
          </p>}
          <NotificationResearchProgress />
        </div>
      )}
    </section>
  );
}
