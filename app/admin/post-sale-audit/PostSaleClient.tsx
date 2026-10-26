"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { summarizeRealizedResults } from "@/lib/research/realTradeSummary";

type Outcome = { days: number; date: string | null; price: number | null; extraYen: number | null };
type Case = { id: string; code: string; name: string; saleDate: string; buyPrice: number; salePrice: number;
  quantity: number; executionNotes?: { executedAtJst: string | null; limitPrice: number | null; reason: string | null; unableToMonitor: boolean }; cohort: "FORWARD" | "LATE_REGISTERED"; realizedProfitYen: number; outcomes: Outcome[] };
type Summary = { cohort: Case["cohort"]; total: number; summary: {
  days: number; evaluated: number; earlySaleCount: number; protectedCount: number; earlySaleRate: number | null }[] };
type Report = { items: Case[]; cohorts: Summary[]; note: string };
const yen = (n: number) => (n > 0 ? "+" : "") + Math.round(n).toLocaleString("ja-JP") + "円";
const sample = { code: "", name: "", saleDate: "",
  buyPrice: "", salePrice: "", quantity: "", executedAtJst: "", limitPrice: "", saleReason: "", unableToMonitor: false };

export default function PostSaleClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [form, setForm] = useState(sample);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/post-sale-audit", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "読み込み失敗");
      setReport(body as Report);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "読み込み失敗"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/post-sale-audit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, buyPrice: Number(form.buyPrice),
          salePrice: Number(form.salePrice), quantity: Number(form.quantity) }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "登録失敗");
      setMessage(body.created
        ? "取引を登録しました。翌取引日以降に確定した日足終値から自動検証します。"
        : "この取引は登録済みです（二重登録していません）。");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "登録失敗"); }
    finally { setBusy(false); }
  }

  const tradeStats = report ? (["FORWARD", "LATE_REGISTERED"] as const).map(cohort => ({
    cohort,
    stats: summarizeRealizedResults(
      [...report.items].filter(item => item.cohort === cohort).reverse()
        .map(item => ({ profitYen: item.realizedProfitYen })),
    ),
  })) : null;

  const field = (key: keyof typeof sample, title: string, kind: string = "text") =>
    <label className="block text-sm font-bold text-slate-700" key={key}>{title}
      <input required type={kind} min={key === "quantity" ? "1" : kind === "number" ? "0.01" : undefined}
        step={kind === "number" ? (key === "quantity" ? "1" : "0.01") : undefined}
        value={form[key]}
        onChange={e => setForm(old => ({...old, [key]: e.target.value}))}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900" />
    </label>;

  return <div className="mt-5 space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="font-black text-slate-900">実取引を登録する</h2>
      <p className="my-2 text-xs leading-5 text-slate-600">実際の約定履歴を確認して入力してください。注文や証券口座への接続は行いません。</p>
      <form className="grid grid-cols-2 gap-3" onSubmit={submit}>
        {field("code", "銘柄コード")}
        {field("name", "銘柄名")}
        {field("saleDate", "売却日", "date")}
        {field("quantity", "株数", "number")}
        {field("buyPrice", "購入約定単価", "number")}
        {field("salePrice", "売却約定単価", "number")}
        <label className="col-span-2 text-sm font-bold text-slate-700">約定日時（日本時間・任意）<input type="datetime-local" step="1" value={form.executedAtJst} onChange={e => setForm(old => ({...old, executedAtJst: e.target.value}))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-bold text-slate-700">指値（任意）<input type="number" min="0.01" step="0.01" value={form.limitPrice} onChange={e => setForm(old => ({...old, limitPrice: e.target.value}))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.unableToMonitor} onChange={e => setForm(old => ({...old, unableToMonitor: e.target.checked}))} />売却後は監視できなかった</label>
        <label className="col-span-2 text-sm font-bold text-slate-700">売却理由（任意・500文字以内）<textarea maxLength={500} value={form.saleReason} onChange={e => setForm(old => ({...old, saleReason: e.target.value}))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <button disabled={busy} type="submit"
          className="col-span-2 rounded-xl bg-blue-600 py-3 font-black text-white disabled:opacity-50">
          {busy ? "登録中…" : "売却済みの取引を登録"}
        </button>
      </form>
      {message && <p role="status" className="mt-3 text-sm font-bold text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
    </section>

    {tradeStats?.map(({ cohort, stats: tradeStats }) => <section key={cohort} className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-black text-slate-900">実売買の成績（税・手数料前）— {cohort === "FORWARD" ? "当日登録" : "過去分登録"}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p>記録件数：<strong>{tradeStats.count}件</strong></p>
        <p>勝率：<strong>{tradeStats.winRate === null ? "未評価" : tradeStats.winRate.toFixed(1) + "%"}</strong></p>
        <p>累積損益：<strong>{yen(tradeStats.total)}</strong></p>
        <p>1件平均：<strong>{tradeStats.expectancy === null ? "未評価" : yen(tradeStats.expectancy)}</strong></p>
        <p>平均利益：<strong>{tradeStats.averageWin === null ? "未評価" : yen(tradeStats.averageWin)}</strong></p>
        <p>平均損失：<strong>{tradeStats.averageLoss === null ? "未評価" : yen(tradeStats.averageLoss)}</strong></p>
        <p className="col-span-2">最大ドローダウン（記録順）：<strong>{yen(tradeStats.maxDrawdown)}</strong></p>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">表示対象は直近最大150件。最大ドローダウンは対象記録を売却日順に並べた参考値で、口座全体の損失を示しません。過去分登録は後知恵を含むため当日登録と分けて表示しています。</p>
      {tradeStats.insufficientSample && <p className="mt-2 text-xs font-bold text-amber-700">30件未満の少数サンプルです。勝率・期待値の再現性は未確認です。</p>}
    </section>)}
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black text-slate-900">売却後の研究結果</h2>
        <button onClick={() => void load()} disabled={loading}
          className="rounded-lg border px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">再読み込み</button>
      </div>
      {loading && <p className="mt-4 text-sm text-slate-500">読み込み中…</p>}
      {!loading && report && report.items.length === 0 &&
        <p className="mt-4 text-sm text-slate-500">まだ登録された取引はありません。</p>}
      <div className="mt-4 space-y-4">
        {report?.items.map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-bold text-slate-900">{item.code} {item.name}</div>
            <span className="text-xs font-bold text-slate-500">
              {item.cohort === "FORWARD" ? "当日登録・前向き検証" : "過去分登録・参考集計"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {item.saleDate} 売却 / {item.buyPrice.toLocaleString()} → {item.salePrice.toLocaleString()}円 × {item.quantity}株
          </p>
          <p className="mt-2 text-sm font-bold text-slate-700">売却確定損益（税引前）：
            <span className={item.realizedProfitYen >= 0 ? "text-emerald-700" : "text-red-600"}>
              {yen(item.realizedProfitYen)}
            </span>
          </p>
          {item.executionNotes && (item.executionNotes.executedAtJst || item.executionNotes.limitPrice || item.executionNotes.reason || item.executionNotes.unableToMonitor) && <p className="mt-2 text-xs text-slate-600">約定日時：{item.executionNotes.executedAtJst || "未記録"} / 指値：{item.executionNotes.limitPrice?.toLocaleString() ?? "未記録"} / 監視不可：{item.executionNotes.unableToMonitor ? "はい" : "いいえ"} / 理由：{item.executionNotes.reason || "未記録"}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {item.outcomes.map(outcome =>
              <div key={outcome.days} className="rounded-xl bg-slate-50 p-2 text-center">
                <p className="text-xs font-bold text-slate-600">{outcome.days}営業日後</p>
                <p className="mt-1 text-xs text-slate-500">{outcome.date || "確認待ち"}</p>
                <p className="mt-1 text-xs font-bold text-slate-900">
                  {outcome.price === null ? "―" : outcome.price.toLocaleString() + "円"}
                </p>
                <p className={"mt-1 text-sm font-black " + (outcome.extraYen === null ? "text-slate-400"
                  : outcome.extraYen >= 0 ? "text-emerald-700" : "text-red-600")}>
                  {outcome.extraYen === null ? "未評価" : yen(outcome.extraYen)}
                </p>
                <p className="text-[10px] text-slate-500">売却との差</p>
              </div>)}
          </div>
        </article>)}
      </div>
    </section>
    {report?.cohorts.map(cohort =>
      <section key={cohort.cohort} className="rounded-xl border border-slate-200 p-3">
        <h3 className="font-bold text-slate-900">
          {cohort.cohort === "FORWARD" ? "前向き登録の集計" : "過去分登録（後知恵を含む参考値）"}：{cohort.total}件
        </h3>
        <div className="mt-2 space-y-1 text-xs text-slate-700">
          {cohort.summary.map(s => <p key={s.days}>
            {s.days}営業日後：評価{s.evaluated}件 / 売却後上昇{s.earlySaleCount}件 / 売却後下落{s.protectedCount}件
            {s.earlySaleRate !== null ? "（上昇率 " + s.earlySaleRate.toFixed(1) + "%）" : ""}
          </p>)}
        </div>
      </section>)}
    <p className="text-xs leading-5 text-slate-500">{report?.note ||
      "売却後の株価は翌取引日以降に確認した日足終値で自動検証します。途中の高値・安値や約定可能価格は対象外です。"}</p>
  </div>;
}
