"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Scope = "all" | "recent30";
type SortMode = "best" | "worst" | "wins" | "losses" | "samples";
type StockRow = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  judged: number;
  winRate: number | null;
  latestDate: string | null;
};
type RankingPayload = {
  success: boolean;
  ranking?: StockRow[];
  updatedAt?: string;
  error?: string;
};

function rate(value: number | null): string {
  return value === null ? "判定なし" : value.toFixed(1) + "%";
}

function CountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminWinRateRankingClient() {
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortMode>("best");
  const [minJudged, setMinJudged] = useState(10);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const [ranking, setRanking] = useState<StockRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch("/api/admin/stock-win-rate-ranking?scope=" + scope, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as RankingPayload;
        if (!response.ok || !payload.success) {
          throw new Error(response.status === 403 ? "管理者としてログインしてください" : payload.error ?? "取得に失敗しました");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setRanking(payload.ranking ?? []);
        setUpdatedAt(payload.updatedAt ?? "");
        setError("");
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setRanking([]);
        setError(e instanceof Error ? e.message : "取得に失敗しました");
        setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [scope]);

  const overall = useMemo(() => {
    const win = ranking.reduce((sum, item) => sum + item.win, 0);
    const lose = ranking.reduce((sum, item) => sum + item.lose, 0);
    const hold = ranking.reduce((sum, item) => sum + item.hold, 0);
    return {
      total: ranking.reduce((sum, item) => sum + item.total, 0),
      win,
      lose,
      hold,
      winRate: win + lose === 0 ? null : Math.round((win / (win + lose)) * 1000) / 10,
    };
  }, [ranking]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ja-JP");
    const items = ranking.filter((item) =>
      item.judged >= minJudged &&
      (!keyword || item.code.toLowerCase().includes(keyword) || item.name.toLocaleLowerCase("ja-JP").includes(keyword)),
    );
    items.sort((a, b) => {
      if (sort === "wins") return b.win - a.win || b.judged - a.judged;
      if (sort === "losses") return b.lose - a.lose || b.judged - a.judged;
      if (sort === "samples") return b.judged - a.judged || b.total - a.total;
      if (a.winRate === null || b.winRate === null) {
        return a.winRate === null ? (b.winRate === null ? b.judged - a.judged : 1) : -1;
      }
      return (sort === "best" ? b.winRate - a.winRate : a.winRate - b.winRate) ||
        b.judged - a.judged || b.total - a.total || a.code.localeCompare(b.code);
    });
    return items;
  }, [ranking, query, minJudged, sort]);

  const shown = filtered.slice(0, visibleCount);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600">← 学習データ・管理室</Link>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700">
            🔒 管理者専用
          </span>
        </div>

        <header className="mt-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-widest text-blue-600">SIGNALX ADMIN / AI LEARNING</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">🏆 全銘柄・勝敗ランキング</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            AIの日次判定を銘柄ごとに比較。勝率・勝ち数・負け数・検証母数で並べ替えできます。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["all", "全期間"],
              ["recent30", "各銘柄の直近30件"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => { if (scope !== value) { setLoading(true); setScope(value); setVisibleCount(40); } }}
                className={scope === value
                  ? "rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
                  : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {loading && <p className="mt-4 rounded-2xl bg-white p-5 text-sm font-bold text-slate-500">勝敗を集計しています…</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-5 text-sm font-bold text-red-700">{error}</p>}

        {!loading && !error && (
          <>
            <section aria-label="集計概要" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <CountCard label="対象銘柄" value={ranking.length.toLocaleString("ja-JP") + "銘柄"} />
              <CountCard label="勝率（勝敗確定のみ）" value={rate(overall.winRate)} />
              <CountCard label="WIN" value={overall.win.toLocaleString("ja-JP")} />
              <CountCard label="LOSE" value={overall.lose.toLocaleString("ja-JP")} />
              <CountCard label="HOLD" value={overall.hold.toLocaleString("ja-JP")} />
              <CountCard label="保存件数" value={overall.total.toLocaleString("ja-JP")} />
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black">ランキング条件</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-bold text-slate-600">
                  銘柄名・コード
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }}
                    placeholder="例：9984 / ソフトバンク"
                    className="mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  並び順
                  <select
                    value={sort}
                    onChange={(e) => { setSort(e.target.value as SortMode); setVisibleCount(40); }}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900"
                  >
                    <option value="best">🏆 勝率が高い順</option>
                    <option value="worst">⚠️ 勝率が低い順</option>
                    <option value="wins">WINが多い順</option>
                    <option value="losses">LOSEが多い順</option>
                    <option value="samples">勝敗確定数が多い順</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  最低勝敗確定数
                  <select
                    value={minJudged}
                    onChange={(e) => { setMinJudged(Number(e.target.value)); setVisibleCount(40); }}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900"
                  >
                    <option value={0}>制限なし（参考値含む）</option>
                    <option value={3}>3件以上</option>
                    <option value={10}>10件以上（標準）</option>
                    <option value={20}>20件以上</option>
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {filtered.length.toLocaleString("ja-JP")}銘柄を表示対象に選択
                {updatedAt ? " ・ 集計 " + new Date(updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : ""}
              </p>
            </section>

            <section aria-label="銘柄別勝敗ランキング" className="mt-3 space-y-2">
              {shown.map((item, index) => (
                <Link
                  key={item.code}
                  href={"/analysis/" + encodeURIComponent(item.code)}
                  className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-black">{item.name} <span className="text-sm text-slate-500">({item.code})</span></p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        検証 {item.total}件・勝敗確定 {item.judged}件・HOLD {item.hold}件・未判定 {item.unknown}件
                      </p>
                      <p className="mt-1 text-xs font-bold">
                        <span className="text-emerald-700">WIN {item.win}</span>
                        <span className="mx-2 text-slate-300">/</span>
                        <span className="text-red-600">LOSE {item.lose}</span>
                        {item.judged < 10 && <span className="ml-2 text-amber-600">⚠ 母数少</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold text-slate-500">勝率</p>
                      <p className="text-xl font-black text-blue-700 sm:text-2xl">{rate(item.winRate)}</p>
                      <p className="mt-1 text-xs font-black text-blue-600">詳細 →</p>
                    </div>
                  </div>
                </Link>
              ))}
              {filtered.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500">
                  条件に合う銘柄がありません。最低勝敗確定数を下げると表示が増えます。
                </p>
              )}
              {filtered.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((value) => value + 40)}
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 font-black text-blue-700"
                >
                  さらに40銘柄を見る（残り {filtered.length - shown.length}）
                </button>
              )}
            </section>

            <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-xs leading-6 text-slate-600">
              勝率 = WIN ÷ (WIN + LOSE)。HOLD・UNKNOWNは勝率から除外します。
              「直近30件」は各銘柄で新しい順に30保存件（HOLD・UNKNOWNも含む）を集計します。
              同じ銘柄の過去の判定結果であり、将来の利益や投資成果を保証しません。
              ランキングは読み取り専用で、AI判定・通知・学習データを変更しません。
            </p>
          </>
        )}
      </div>
    </main>
  );
}
