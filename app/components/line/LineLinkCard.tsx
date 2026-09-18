"use client";

import { useCallback, useEffect, useState } from "react";

type LineStatusResponse = {
  success: boolean;
  linked?: boolean;
  linkedAt?: string | null;
  error?: string;
};

type LineLinkResponse = {
  success: boolean;
  token?: string;
  expiresInSeconds?: number;
  instructions?: string;
  error?: string;
};

export default function LineLinkCard() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/line-user", { cache: "no-store" });
      const data = (await response.json()) as LineStatusResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "LINE連携状態を確認できませんでした");
      }
      setLinked(Boolean(data.linked));
      if (data.linked) setInstruction("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "LINE連携状態を確認できませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function createLinkCode() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/line-user", { method: "POST" });
      const data = (await response.json()) as LineLinkResponse;
      if (!response.ok || !data.success || !data.instructions) {
        throw new Error(data.error || "LINE連携コードを発行できませんでした");
      }
      setInstruction(data.instructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LINE連携コードを発行できませんでした");
    } finally {
      setCreating(false);
    }
  }

  async function copyInstruction() {
    if (!instruction) return;
    const match = instruction.match(/「(.+)」/);
    const message = match?.[1] ?? instruction;
    await navigator.clipboard.writeText(message);
  }

  return (
    <section className="mt-5 rounded-[30px] border border-green-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-green-600">LINE ALERT</p>
          <h2 className="mt-1 text-xl font-black">LINE連携</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${linked ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
          {loading ? "確認中" : linked ? "連携済み" : "未連携"}
        </span>
      </div>

      <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
        お気に入り銘柄でAIの買い条件が成立した時や、利確・損切に到達した時の通知をあなたのLINEへ送ります。
      </p>

      {linked ? (
        <div className="mt-4 rounded-[22px] bg-green-50 p-4 text-sm font-black text-green-700">
          ✓ SIGNALXとLINEは連携済みです
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={createLinkCode}
            disabled={loading || creating}
            className="mt-4 w-full rounded-full bg-[#06c755] px-6 py-4 text-sm font-black text-white shadow-sm disabled:opacity-50"
          >
            {creating ? "連携コードを発行中..." : "LINEを連携する"}
          </button>

          {instruction ? (
            <div className="mt-4 rounded-[22px] bg-green-50 p-4">
              <p className="text-xs font-black text-green-700">10分以内にLINEへ送信</p>
              <p className="mt-2 break-all text-sm font-bold leading-6 text-slate-700">{instruction}</p>
              <button type="button" onClick={copyInstruction} className="mt-3 w-full rounded-full bg-white px-4 py-3 text-sm font-black text-green-700 shadow-sm">
                送信メッセージをコピー
              </button>
              <button type="button" onClick={() => void refreshStatus()} className="mt-2 w-full rounded-full border border-green-200 bg-transparent px-4 py-3 text-sm font-black text-green-700">
                連携できたか確認
              </button>
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="mt-3 text-xs font-bold text-red-600">{error}</p> : null}
    </section>
  );
}
