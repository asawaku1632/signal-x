"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";
import { calculateNanpin, type NanpinComparison } from "@/app/lib/nanpinScenario";
import { evaluateNanpinResearch } from "@/app/lib/nanpinResearch";

type PaperTrade = {
  id: number;
  code: string;
  name: string;
  entryPrice: number;
  quantity: number;
  status: "OPEN" | "CLOSED";
};
type Stock = {
  code: string; price?: number; currentPrice?: number;
  score?: number | null; aiPower?: number | null; rsi?: number | null;
  changePercent?: number | null; volumeRatio?: number | null; stopLoss?: number | null;
};
const finiteNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
type Field = "entryPrice" | "heldShares" | "addPrice" | "addShares" | "futurePrice";
type FormValues = Record<Field, string>;
type PriceSource = "example" | "reference" | "assumption" | "edited";

const EXAMPLE: FormValues = {
  entryPrice: "1000",
  heldShares: "100",
  addPrice: "800",
  addShares: "100",
  futurePrice: "900",
};
const currency = (value: number) =>
  `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value)}円`;
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${currency(value)}`;
const percent = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number) =>
  value < 0 ? "text-rose-700" : value > 0 ? "text-emerald-700" : "text-slate-800";

function ComparisonTable({ title, price, result }: {
  title: string; price: number; result: NanpinComparison;
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-black">{title}</h3>
      <span className="text-sm font-bold text-slate-700">{currency(price)}</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-slate-100 p-3">
        <p className="text-xs font-bold text-slate-600">買い増ししない</p>
        <p className={`mt-2 text-lg font-black ${tone(result.beforeYen)}`}>{signed(result.beforeYen)}</p>
        <p className="text-[11px] text-slate-500">{percent(result.beforePercent)}</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-3">
        <p className="text-xs font-bold text-blue-700">買い増しする</p>
        <p className={`mt-2 text-lg font-black ${tone(result.afterYen)}`}>{signed(result.afterYen)}</p>
        <p className="text-[11px] text-slate-500">{percent(result.afterPercent)}</p>
      </div>
    </div>
    <p className="mt-2 text-xs text-slate-600">
      買い増しによる損益差：<strong className={tone(result.differenceYen)}>{signed(result.differenceYen)}</strong>
      <span className="ml-1 text-slate-500">（追加購入した株の損益分）</span>
    </p>
  </section>;
}

export default function NanpinComparisonPage() {
  const [form, setForm] = useState<FormValues>(EXAMPLE);
  const [tradeId, setTradeId] = useState("example");
  const [openTrades, setOpenTrades] = useState<PaperTrade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [marketStocks, setMarketStocks] = useState<Record<string, Stock>>({});
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [snapshotStale, setSnapshotStale] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [priceSource, setPriceSource] = useState<PriceSource>("example");

  useEffect(() => {
    let active = true;
    // Both endpoints are read with GET only. No purchase, sell or database mutation.
    void Promise.allSettled([
      fetch("/api/paper-trades", { method: "GET", cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error("保有情報を読み取れませんでした（ログインを確認してください）");
          const data = await r.json();
          return (Array.isArray(data?.trades) ? data.trades : []) as PaperTrade[];
        }),
      fetch("/api/simulation-stocks", { method: "GET", cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error("参考株価の取得に失敗しました");
          const data = await r.json();
          return {
            stocks: (Array.isArray(data?.stocks) ? data.stocks : []) as Stock[],
            updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
            stale: data?.stale !== false,
          };
        }),
    ]).then(([trades, stocks]) => {
      if (!active) return;
      if (trades.status === "fulfilled") {
        setOpenTrades(trades.value.filter((t) =>
          t.status === "OPEN" && Number.isFinite(t.entryPrice) && t.entryPrice > 0 &&
          Number.isSafeInteger(t.quantity) && t.quantity > 0));
      } else {
        setLoadNote(trades.reason instanceof Error ? trades.reason.message : "保有情報を取得できませんでした");
      }
      if (stocks.status === "fulfilled") {
        const prices: Record<string, number> = {};
        const details: Record<string, Stock> = {};
        for (const s of stocks.value.stocks) {
          if (s.code) details[s.code] = s;
          const value = Number(s.price ?? s.currentPrice);
          if (s.code && Number.isFinite(value) && value > 0) prices[s.code] = value;
        }
        setQuotes(prices);
        setMarketStocks(details);
        setSnapshotUpdatedAt(stocks.value.updatedAt);
        setSnapshotStale(stocks.value.stale);
      }
    });
    return () => { active = false; };
  }, []);

  function chooseTrade(id: string) {
    setTradeId(id);
    if (id === "example") {
      setForm(EXAMPLE);
      setPriceSource("example");
      return;
    }
    const trade = openTrades.find((t) => String(t.id) === id);
    if (!trade) return;
    const reference = quotes[trade.code];
    const assumed = Number.isFinite(reference) && reference > 0
      ? reference
      : Math.round(trade.entryPrice * 0.8 * 100) / 100;
    setForm({
      entryPrice: String(trade.entryPrice),
      heldShares: String(trade.quantity),
      addPrice: String(assumed),
      addShares: "100",
      futurePrice: String(assumed),
    });
    setPriceSource(reference ? "reference" : "assumption");
  }

  function update(field: Field, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "addPrice" || field === "futurePrice") setPriceSource("edited");
  }

  const input = useMemo(() => ({
    entryPrice: form.entryPrice.trim() ? Number(form.entryPrice) : NaN,
    heldShares: form.heldShares.trim() ? Number(form.heldShares) : NaN,
    addPrice: form.addPrice.trim() ? Number(form.addPrice) : NaN,
    addShares: form.addShares.trim() ? Number(form.addShares) : NaN,
    futurePrice: form.futurePrice.trim() ? Number(form.futurePrice) : NaN,
  }), [form]);

  const result = calculateNanpin(input);
  const selectedTrade = openTrades.find((t) => String(t.id) === tradeId);
  const selectedStock = selectedTrade ? marketStocks[selectedTrade.code] : undefined;
  const research = result && selectedTrade ? evaluateNanpinResearch({
    entryPrice: input.entryPrice,
    addPrice: input.addPrice,
    initialCost: result.initialCost,
    additionalCost: result.additionalCost,
    referencePrice: finiteNumber(selectedStock?.price ?? selectedStock?.currentPrice),
    snapshotUpdatedAt,
    snapshotStale,
    aiPower: finiteNumber(selectedStock?.score ?? selectedStock?.aiPower),
    rsi: finiteNumber(selectedStock?.rsi),
    changePercent: finiteNumber(selectedStock?.changePercent),
    volumeRatio: finiteNumber(selectedStock?.volumeRatio),
    stopLoss: finiteNumber(selectedStock?.stopLoss),
  }) : null;
  const inputClasses = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg font-bold text-slate-900 focus:border-blue-500 focus:outline-none";

  const fields: { key: Field; title: string; help: string; step: string }[] = [
    { key: "entryPrice", title: "最初の購入単価（円）", help: "すでに持っている株の単価", step: "0.01" },
    { key: "heldShares", title: "保有株数（株）", help: "現在の保有数", step: "1" },
    { key: "addPrice", title: "買い増し予定単価（円）", help: "この価格で追加購入したと仮定", step: "0.01" },
    { key: "addShares", title: "買い増し株数（株）", help: "初期値は100株。実際の注文はしません", step: "1" },
    { key: "futurePrice", title: "比較する株価（円）", help: "今後この株価になったら？を自由に入力", step: "0.01" },
  ];

  return <main className="min-h-screen bg-slate-50 pb-24 text-slate-900">
    <div className="mx-auto min-h-screen max-w-md bg-slate-50 px-4 py-5">
      <a href="/simulation" className="text-sm font-bold text-blue-700">← 疑似投資に戻る</a>
      <header className="mt-5">
        <p className="text-xs font-black tracking-wider text-blue-700">SIGNALX / READ-ONLY RESEARCH</p>
        <h1 className="mt-1 text-2xl font-black">📉 ナンピン損益比較</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          買い増しした場合と、しなかった場合。平均購入価格・必要資金・さらに下落した際の損失を比較します。
        </p>
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-800">
          🔒 計算専用です。実際の売買はせず、疑似購入の記録・成績・AI判定・通知も変更・保存しません。
        </p>
      </header>

      <section className="mt-5 rounded-2xl border bg-white p-4">
        <label htmlFor="nanpin-trade" className="text-sm font-black">比較したい銘柄</label>
        <select id="nanpin-trade" value={tradeId} onChange={(e) => chooseTrade(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold">
          <option value="example">練習用（1,000円→800円・100株ずつ）</option>
          {openTrades.map((trade) => <option key={trade.id} value={String(trade.id)}>
            {trade.code} {trade.name}（{trade.quantity}株）
          </option>)}
        </select>
        {loadNote && <p className="mt-2 text-xs text-amber-700">{loadNote}。練習用の計算は使えます。</p>}
        {selectedTrade && <p className="mt-2 text-xs text-slate-500">
          実際の疑似保有記録から、購入単価・株数だけを読み取りました。
        </p>}
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {priceSource === "reference"
            ? "買い増し単価と比較株価の初期値には、SIGNALX取得の参考株価を使用。リアルタイムの約定価格ではありません。"
            : priceSource === "assumption"
              ? "最新の参考株価を確認できないため、買い増し単価には購入単価の80%という仮定を入力しています。必要に応じて変更してください。"
              : "価格は自由に変更できる想定値です。実際の株価予測ではありません。"}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">① 価格と株数を入力</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {fields.map((field) => <label key={field.key} className={field.key === "futurePrice" ? "col-span-2" : ""}>
            <span className="text-xs font-bold text-slate-700">{field.title}</span>
            <input type="number" inputMode="decimal" min={field.key === "futurePrice" ? "0" : "0.01"}
              step={field.step} value={form[field.key]} onChange={(e) => update(field.key, e.target.value)}
              className={inputClasses} />
            <span className="mt-1 block text-[10px] leading-4 text-slate-500">{field.help}</span>
          </label>)}
        </div>
        <button type="button" onClick={() => chooseTrade("example")}
          className="mt-3 text-xs font-bold text-blue-700 underline underline-offset-2">練習用の数字に戻す</button>
      </section>

      {!result ? <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
        単価は正の数、株数は1株以上の整数で入力してください。比較株価は0円以上です。
      </div> : <>
        <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-lg font-black">② 買い増し後の変化</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-slate-600">現在の平均購入単価</p>
              <p className="mt-1 text-xl font-black">{currency(input.entryPrice)}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-bold text-blue-700">買い増し後の平均単価</p>
              <p className="mt-1 text-xl font-black text-blue-800">{currency(result.averagePrice)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">
            {result.lowerBreakEvenBy > 0
              ? `損益ゼロに必要な株価が、1株あたり${currency(result.lowerBreakEvenBy)}下がります。`
              : result.lowerBreakEvenBy < 0
                ? `平均購入単価が1株あたり${currency(-result.lowerBreakEvenBy)}上がります。`
                : "平均購入単価は変わりません。"}
          </p>
          <dl className="mt-3 divide-y divide-blue-200 text-sm">
            <div className="flex justify-between py-2"><dt>もともとの購入資金</dt><dd className="font-bold">{currency(result.initialCost)}</dd></div>
            <div className="flex justify-between py-2"><dt>新たに必要な資金</dt><dd className="font-black text-rose-700">{currency(result.additionalCost)}</dd></div>
            <div className="flex justify-between py-2"><dt>購入資金の合計</dt><dd className="font-black">{currency(result.totalCost)}</dd></div>
            <div className="flex justify-between py-2"><dt>買い増し後の合計株数</dt><dd className="font-black">{result.totalShares.toLocaleString("ja-JP")}株</dd></div>
          </dl>
          {input.addPrice >= input.entryPrice && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-900">
            ※ 最初の単価より安く買っていないため、これはナンピンではなく通常の買い増しです。
          </p>}
        </section>

        <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-[11px] font-black tracking-wide text-indigo-700">SIGNALX / SHADOW RESEARCH</p>
          <h2 className="mt-1 text-lg font-black">🤖 ナンピン判断の研究表示（試験版）</h2>
          <p className="mt-2 text-xs leading-5 text-slate-700">
            現在のSIGNALX分析指標を、暫定的なルールに当てはめます。
            過去のナンピン成績で検証されたAIモデルではなく、買い増し指示でもありません。
          </p>
          {!selectedTrade ? <div className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
            練習用では銘柄の分析データがないため判定しません。上の「比較したい銘柄」から保有中の疑似銘柄を選んでね。
          </div> : research && <>
            <div className={`mt-3 rounded-xl border p-3 ${research.status === "RISK"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : research.status === "WATCH"
                ? "border-indigo-200 bg-white text-indigo-800"
                : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="text-xs font-bold">研究上の目安</p>
              <p className="mt-1 text-xl font-black">{research.label}</p>
              <p className="mt-2 text-xs font-medium leading-5">{research.explanation}</p>
            </div>
            {research.reasons.length > 0 && <div className="mt-3 space-y-1">
              {research.reasons.map((reason, i) => <p key={i} className="text-xs leading-5 text-slate-700">・{reason}</p>)}
            </div>}
            <p className="mt-3 text-[11px] leading-5 text-slate-600">
              保存株価の取得時刻：{snapshotUpdatedAt && Number.isFinite(Date.parse(snapshotUpdatedAt))
                ? new Date(snapshotUpdatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                : "確認できません"}。
              参考株価はリアルタイムの注文価格ではありません。
              予定単価が参考株価から1%超離れる場合や、分析値が欠ける場合は判定を保留します。
            </p>
          </>}
          <a href="/glossary" className="mt-3 inline-block text-xs font-black text-blue-700 underline underline-offset-2">📘 用語集で「ナンピン」を確認 →</a>
        </section>

        <section className="mt-4 space-y-3">
          <h2 className="text-lg font-black">③ 損益を比較</h2>
          <ComparisonTable title="入力した想定株価になった場合" price={input.futurePrice} result={result.selected} />
          <ComparisonTable title="買い増し単価からさらに10%下がった場合" price={result.downTenPercentPrice} result={result.downTenPercent} />
        </section>
        <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-black text-rose-800">⚠ ナンピンの注意点</h2>
          <p className="mt-2 text-xs leading-6 text-rose-900">
            平均購入単価が下がっても、損失が確定して消えるわけではありません。
            さらに株価が下がれば追加した株数の分まで損失が増えます。
            買い増し資金を使うため、他の銘柄に使えるお金も減ります。
          </p>
        </section>
      </>}

      <p className="mt-5 text-[11px] leading-5 text-slate-500">
        これは仮定の株価で行う計算です。手数料・税金・スリッページは含みません。
        AIによる買い推奨・将来予測・勝率保証ではありません。株価と売買数量はご自身で確認してください。
      </p>
    </div>
    <BottomNav />
  </main>;
}
