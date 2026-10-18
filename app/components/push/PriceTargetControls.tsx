"use client";

import { useCallback, useEffect, useState } from "react";

type Target = {
  id: string;
  code: string;
  direction: "ABOVE" | "BELOW";
  threshold: number;
  notified_at: string | null;
};

const HEADERS = { "Content-Type": "application/json", "X-SIGNALX-Request": "push-ui" };

export default function PriceTargetControls({ enabled }: { enabled: boolean }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [code, setCode] = useState("");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  const loadTargets = useCallback(async () => {
    const res = await fetch("/api/push/price-targets", { cache: "no-store" });
    if (!res.ok) throw new Error("Load failed");
    const body = await res.json() as { targets: Target[] };
    setTargets(body.targets ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadTargets().catch(() => {
      if (alive) setMessage("設定した株価の一覧を取得できませんでした。");
    }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [loadTargets]);

  async function addTarget() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/price-targets", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ code: code.trim().toUpperCase(), direction, threshold: Number(price) }),
      });
      if (!response.ok) {
        setMessage(response.status === 409
          ? "同じ条件が登録済み、または20件の上限に達しています。"
          : "入力内容を確認してください。銘柄コード4桁・株価は0.01円以上です。");
        return;
      }
      setCode("");
      setPrice("");
      await loadTargets();
      setMessage("指定株価を登録しました。株価が条件に到達すると1回通知します。");
    } catch {
      setMessage("登録に失敗しました。通信状況をご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTarget(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/price-targets", {
        method: "DELETE", headers: HEADERS, body: JSON.stringify({ id: Number(id) }),
      });
      if (!response.ok) throw new Error("Delete failed");
      await loadTargets();
      setMessage("指定株価を削除しました。");
    } catch {
      setMessage("削除に失敗しました。再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  const valid = /^[0-9A-Za-z]{4}$/.test(code.trim()) && Number(price) > 0 &&
    Number(price) <= 1_000_000_000 && Number.isFinite(Number(price));

  return (
    <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/60 p-4">
      <h3 className="text-base font-black text-slate-900">🎯 指定株価を登録</h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        株式市場の取引時間中、最新のAIスキャン参考株価で条件を確認します。
        約定価格やリアルタイムの値段を保証する通知ではありません。
      </p>
      {!enabled && <p className="mt-2 text-xs font-bold text-amber-700">
        指定株価通知をONにして「通知の設定を保存」すると配信可能になります。
      </p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-bold text-slate-600">
          銘柄コード（4桁）
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={4}
            placeholder="7203" inputMode="text"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-base font-bold text-slate-900" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          目標株価（円）
          <input value={price} onChange={(e) => setPrice(e.target.value)}
            type="number" min="0.01" max="1000000000" step="0.01" placeholder="3000"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-base font-bold text-slate-900" />
        </label>
      </div>
      <label className="mt-3 block text-xs font-bold text-slate-600">
        通知する条件
        <select value={direction} onChange={(e) => setDirection(e.target.value as "ABOVE" | "BELOW")}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900">
          <option value="ABOVE">目標株価以上になったら</option>
          <option value="BELOW">目標株価以下になったら</option>
        </select>
      </label>
      <button type="button" disabled={!enabled || !valid || busy || targets.length >= 20}
        onClick={() => void addTarget()}
        className="mt-3 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
        目標株価を登録
      </button>
      <p className="mt-4 text-xs font-bold text-slate-500">登録済み：{targets.length}/20件</p>
      {loaded && targets.length === 0 && <p className="mt-2 text-xs text-slate-500">まだ登録されていません。</p>}
      <div className="mt-2 space-y-2">
        {targets.map((target) => (
          <div key={target.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3">
            <div>
              <p className="text-sm font-black text-slate-900">
                {target.code}・{Number(target.threshold).toLocaleString("ja-JP")}円
                {target.direction === "ABOVE" ? "以上" : "以下"}
              </p>
              <p className="text-xs text-slate-500">{target.notified_at ? "通知済み（再設定は削除後）" : "監視中"}</p>
            </div>
            <button type="button" disabled={busy}
              onClick={() => void deleteTarget(target.id)}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">
              削除
            </button>
          </div>
        ))}
      </div>
      {message && <p role="status" className="mt-3 text-xs font-bold leading-5 text-slate-700">{message}</p>}
    </div>
  );
}
