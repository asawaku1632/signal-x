import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";
import { SCAN_SNAPSHOT_KEY } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawPattern = { id: string; confidence: number | null; reasons: string[] | null };
type AuditStock = {
  code: string;
  name: string;
  score: number | null;
  price: number | null;
  observations: RawPattern[];
  displayed: RawPattern[];
};
type AuditMatch = {
  stock: AuditStock;
  confidence: number | null;
  breakout: "recorded" | "not-recorded" | "unknown";
};
type PatternSummary = {
  id: string;
  name: string;
  direction: string;
  count: number;
  highConfidence: number;
  confidence96: number;
  withReason: number;
  withBreakoutRecord: number;
};
type AuditSnapshot = {
  updatedAt: string | null;
  requestedCount: number;
  scannedCount: number;
  stocks: AuditStock[];
  error: string | null;
};
type ForwardHealth = {
  total: number;
  completed1: number;
  completed3: number;
  completed5: number;
  firstDate: string | null;
  lastDate: string | null;
  latestDaily: string | null;
  error: string | null;
};

const ids = new Set(chartPatternCatalog.map((pattern) => pattern.id));
const doubleBottomId = "pattern002";
const breakoutReason = "ネックラインを上抜け";

function numeric(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parsePatterns(value: unknown): RawPattern[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  const patterns: RawPattern[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !ids.has(candidate.id) || unique.has(candidate.id)) continue;
    unique.add(candidate.id);
    patterns.push({
      id: candidate.id,
      confidence: numeric(candidate.confidence),
      reasons: Array.isArray(candidate.reasons)
        ? candidate.reasons.filter((reason): reason is string => typeof reason === "string")
        : null,
    });
  }
  return patterns;
}

// Restricted to the owner. This is a projection of existing saved scan data,
// not a new scan and not a write to AI scoring, notification or learning tables.
async function loadSnapshot(): Promise<AuditSnapshot> {
  try {
    const { rows } = await pool.query<{
      updated_at: Date | string;
      item_count: number;
      scanned_count: number;
      projected: unknown;
    }>(`
      WITH s AS (
        SELECT updated_at, item_count,
          CASE WHEN jsonb_typeof(payload->'stocks')='array'
            THEN payload->'stocks' ELSE '[]'::jsonb END AS items
        FROM display_snapshots WHERE snapshot_key = $1
      )
      SELECT s.updated_at, s.item_count,
        jsonb_array_length(s.items) AS scanned_count,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'code', x.item->>'code',
            'name', x.item->>'name',
            'score', x.item->'score',
            'price', x.item->'price',
            'observations', CASE
              WHEN jsonb_typeof(x.item->'patternObservations')='array'
                THEN x.item->'patternObservations'
              ELSE x.item->'detectedPatterns'
            END,
            'displayed', x.item->'detectedPatterns'
          ) ORDER BY x.ordinality)
          FROM jsonb_array_elements(s.items) WITH ORDINALITY AS x(item, ordinality)
        ), '[]'::jsonb) AS projected
      FROM s
    `, [SCAN_SNAPSHOT_KEY]);
    const row = rows[0];
    if (!row) return { updatedAt: null, requestedCount: 0, scannedCount: 0, stocks: [], error: "保存スキャンがありません" };

    const stocks: AuditStock[] = [];
    for (const value of Array.isArray(row.projected) ? row.projected : []) {
      if (!value || typeof value !== "object") continue;
      const raw = value as Record<string, unknown>;
      if (typeof raw.code !== "string" || !/^[0-9A-Za-z]{4,5}$/.test(raw.code)) continue;
      stocks.push({
        code: raw.code,
        name: typeof raw.name === "string" ? raw.name : raw.code,
        score: numeric(raw.score),
        price: numeric(raw.price),
        observations: parsePatterns(raw.observations),
        displayed: parsePatterns(raw.displayed),
      });
    }

    const date = new Date(row.updated_at);
    return {
      updatedAt: Number.isFinite(date.getTime()) ? date.toISOString() : null,
      requestedCount: Number(row.item_count ?? 0),
      scannedCount: Number(row.scanned_count ?? 0),
      stocks,
      error: null,
    };
  } catch (error) {
    console.error("private chart pattern accuracy audit snapshot:", error);
    return { updatedAt: null, requestedCount: 0, scannedCount: 0, stocks: [], error: "保存スキャンを読み取れませんでした" };
  }
}

async function loadForwardHealth(): Promise<ForwardHealth> {
  try {
    const { rows } = await pool.query<{
      total: number;
      completed1: number;
      completed3: number;
      completed5: number;
      first_date: string | null;
      last_date: string | null;
      latest_daily: string | null;
    }>(`
      SELECT COUNT(*)::int AS total,
        COUNT(return_1d)::int AS completed1,
        COUNT(return_3d)::int AS completed3,
        COUNT(return_5d)::int AS completed5,
        MIN(trade_date)::text AS first_date,
        MAX(trade_date)::text AS last_date,
        (SELECT MAX(date::date)::text FROM daily_stock_results) AS latest_daily
      FROM pattern_forward_observations
    `);
    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      completed1: Number(row?.completed1 ?? 0),
      completed3: Number(row?.completed3 ?? 0),
      completed5: Number(row?.completed5 ?? 0),
      firstDate: row?.first_date ?? null,
      lastDate: row?.last_date ?? null,
      latestDaily: row?.latest_daily ?? null,
      error: null,
    };
  } catch (error) {
    console.error("private pattern forward audit health:", error);
    return { total: 0, completed1: 0, completed3: 0, completed5: 0, firstDate: null, lastDate: null, latestDaily: null, error: "学習テーブルを読み取れませんでした" };
  }
}

function breakoutLabel(value: AuditMatch["breakout"]) {
  if (value === "recorded") return "ネックライン突破の記録あり";
  if (value === "not-recorded") return "保存された理由に突破記録なし";
  return "判定理由未保存（不明）";
}

function collectMatches(stocks: AuditStock[], patternId: string): AuditMatch[] {
  return stocks.flatMap((stock) => {
    const pattern = stock.observations.find((item) => item.id === patternId);
    if (!pattern) return [];
    const details = stock.displayed.find((item) => item.id === patternId);
    const breakout = details?.reasons === null || details === undefined
      ? "unknown"
      : details.reasons.includes(breakoutReason) ? "recorded" : "not-recorded";
    return [{ stock, confidence: pattern.confidence, breakout } satisfies AuditMatch];
  });
}

// Reproducible distributed audit sample: avoid selecting only the highest AI POWER.
// Up to five from each evidence bucket, then fill from the remaining population.
function sampleMatches(matches: AuditMatch[], patternId: string): AuditMatch[] {
  const ordered = [...matches].sort((a, b) => a.stock.code.localeCompare(b.stock.code, "ja", { numeric: true }));
  const buckets = patternId === doubleBottomId
    ? [
        ordered.filter((m) => m.breakout === "recorded"),
        ordered.filter((m) => m.breakout === "not-recorded"),
        ordered.filter((m) => m.breakout === "unknown"),
      ]
    : [
        ordered.filter((m) => (m.confidence ?? 0) === 96),
        ordered.filter((m) => (m.confidence ?? 0) >= 85 && (m.confidence ?? 0) < 96),
        ordered.filter((m) => (m.confidence ?? 0) < 85),
      ];
  const picks: AuditMatch[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    if (!bucket.length) continue;
    const take = Math.min(5, bucket.length);
    for (let i = 0; i < take; i++) {
      const entry = bucket[Math.floor((i + 0.5) * bucket.length / take)];
      if (!seen.has(entry.stock.code)) { picks.push(entry); seen.add(entry.stock.code); }
    }
  }
  return picks;
}

function summarize(stocks: AuditStock[]): PatternSummary[] {
  return chartPatternCatalog.map((pattern) => {
    const matches = collectMatches(stocks, pattern.id);
    return {
      id: pattern.id,
      name: pattern.name,
      direction: pattern.direction,
      count: matches.length,
      highConfidence: matches.filter((x) => (x.confidence ?? -1) >= 85).length,
      confidence96: matches.filter((x) => x.confidence === 96).length,
      withReason: matches.filter((x) => x.breakout !== "unknown").length,
      withBreakoutRecord: matches.filter((x) => x.breakout === "recorded").length,
    };
  }).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

type Props = { searchParams: Promise<{ pattern?: string }> };

export default async function ShapePrecisionAuditPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const [snapshot, forward] = await Promise.all([loadSnapshot(), loadForwardHealth()]);
  const summaries = summarize(snapshot.stocks);
  const requestedId = (await searchParams).pattern;
  const selectedId = requestedId && ids.has(requestedId) ? requestedId : doubleBottomId;
  const selected = summaries.find((item) => item.id === selectedId);
  const matches = collectMatches(snapshot.stocks, selectedId);
  const samples = sampleMatches(matches, selectedId);
  const visibleReasons = matches.filter((x) => x.breakout !== "unknown").length;
  const confirmed = matches.filter((x) => x.breakout === "recorded").length;
  const share = snapshot.scannedCount > 0 ? (matches.length * 100 / snapshot.scannedCount).toFixed(1) : "—";
  const refreshed = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "未取得";

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">← 学習管理へ</Link>
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black">🔒 本人限定・読み取り専用</span>
        </div>
        <h1 className="mt-5 text-2xl font-black">🔬 チャート形状の検出精度監査</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          検出件数・信頼度の偏り・判定理由を監査し、実際のチャートを確認するためのサンプルを表示します。
          この画面だけでは「形が正しい割合」や未来の勝率は確定できません。
        </p>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-black">最新保存スキャンの状況</h2>
          <p className="mt-2 text-xs text-slate-600">保存日時 {refreshed}（日本時間）</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["取得銘柄", snapshot.scannedCount],
              ["対象予定", snapshot.requestedCount],
              ["検出対象", summaries.reduce((sum, item) => sum + (item.count > 0 ? 1 : 0), 0)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-2">
                <div className="text-[11px] text-slate-600">{label}</div>
                <div className="text-xl font-black">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">検出対象は「55形状のうち、今回1件以上出た種類数」です。形状は同じ銘柄に重複して検出されます。</p>
          {snapshot.error && <p className="mt-2 font-bold text-red-700">{snapshot.error}</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-black">過去結果の蓄積状況</h2>
          {forward.error ? <p className="mt-2 text-sm text-red-700">{forward.error}</p> : (
            <>
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {[
                  ["検出保存", forward.total],
                  ["1日結果", forward.completed1],
                  ["3日結果", forward.completed3],
                  ["5日結果", forward.completed5],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-blue-50 px-1 py-3">
                    <div className="text-[10px] font-bold text-slate-600">{label}</div>
                    <div className="mt-1 text-lg font-black text-blue-900">{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-600">
                記録開始 {forward.firstDate ?? "—"} ／最新検出 {forward.lastDate ?? "—"} ／日次株価の保存最終日 {forward.latestDaily ?? "—"}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                5日結果が0でも、まだ5営業日が経過していなければ正常です。
                保存開始後の取引日数と日次株価の更新を合わせて確認してください。
              </p>
            </>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-indigo-200 bg-white p-4">
          <h2 className="font-black">調べる形状を選ぶ</h2>
          <form action="/admin/shape-precision-audit" method="get" className="mt-3 flex flex-wrap gap-2">
            <select name="pattern" defaultValue={selectedId}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm">
              {summaries.map((item) => (
                <option key={item.id} value={item.id}>{item.name}（{item.count}銘柄）</option>
              ))}
            </select>
            <button type="submit" className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-black text-white">表示</button>
          </form>
          {selected && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["検出数", selected.count + "件"],
                ["全取得に占める割合", share + "%"],
                ["信頼度85以上", selected.highConfidence + "件"],
                ["信頼度96", selected.confidence96 + "件"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-indigo-50 p-3 text-center">
                  <div className="text-[11px] text-slate-700">{label}</div>
                  <div className="mt-1 text-xl font-black">{value}</div>
                </div>
              ))}
            </div>
          )}
          {selectedId === doubleBottomId && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6">
              <p className="font-black">ダブルボトム特別監査</p>
              <p>判定理由を確認できた件数 {visibleReasons}件 ／そのうち「ネックラインを上抜け」記録あり {confirmed}件</p>
              <p>理由に突破記録がない件数 {visibleReasons - confirmed}件 ／理由そのものが未保存 {matches.length - visibleReasons}件</p>
              <p className="mt-2 text-xs leading-5 text-amber-900">
                現在の判定コードは過去60本以内の安値2つ（差3.5%以内）、直近株価が二番目の安値より1%以上上昇という条件で候補を検出します。
                ネックライン突破は必須ではありません。理由がないだけで「突破していない」とは断定できません。
                信頼度の上限96は形状判定スコアの上限で、将来上昇確率ではありません。
              </p>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-black">実際のチャートを確認するサンプル（最大15銘柄）</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            銘柄コード順に母集団から間隔を空けて抽出し、判定理由の種類（ダブルボトム以外は信頼度帯）ごとに最大5件を表示。
            AI POWERや株価の高い順ではありません。正しい形かどうかはチャートを開いて目視確認してください。
          </p>
          <div className="mt-3 space-y-2">
            {samples.length ? samples.map(({ stock, confidence, breakout }) => (
              <article key={stock.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black">{stock.name}（{stock.code}）</p>
                    <p className="mt-1 text-xs text-slate-600">
                      AI POWER {stock.score === null ? "—" : Math.round(stock.score)}
                      ／検出信頼度 {confidence === null ? "—" : Math.round(confidence) + "%"}
                    </p>
                    {selectedId === doubleBottomId && (
                      <p className="mt-1 text-xs font-bold text-amber-800">{breakoutLabel(breakout)}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/chart/${stock.code}`} className="grid min-h-11 place-items-center rounded-xl bg-blue-700 px-3 text-xs font-black text-white">チャート</Link>
                    <Link href={`/analysis/${stock.code}`} className="grid min-h-11 place-items-center rounded-xl border border-blue-300 bg-white px-3 text-xs font-black text-blue-700">AI解析</Link>
                  </div>
                </div>
              </article>
            )) : <p className="text-sm text-slate-500">該当する保存済み銘柄がありません。</p>}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-black">55種類の発生数・信頼度一覧</h2>
          <p className="mt-2 text-xs text-slate-600">件数が多い順。値は最新の保存スキャン1回分で、勝率ではありません。</p>
          <div className="mt-3 max-h-[560px] overflow-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr><th className="p-2">形状</th><th className="p-2 text-right">一致</th><th className="p-2 text-right">85以上</th><th className="p-2 text-right">96</th></tr>
              </thead>
              <tbody>
                {summaries.map((item) => (
                  <tr key={item.id} className={item.id === selectedId ? "bg-blue-50" : "border-t border-slate-100"}>
                    <td className="p-2">
                      <Link href={`/admin/shape-precision-audit?pattern=${encodeURIComponent(item.id)}`}
                        className="font-bold text-blue-700">{item.name}</Link>
                    </td>
                    <td className="p-2 text-right">{item.count}</td>
                    <td className="p-2 text-right">{item.highConfidence}</td>
                    <td className="p-2 text-right">{item.confidence96}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-5 text-xs leading-6 text-slate-500">
          SHADOW / READ ONLY：既存スナップショットと未来結果表のSELECTのみ。新規スキャンや外部の株価再取得、
          売買、通知、AI POWERや学習データの更新はしません。実際のパターン一致精度の確定には、検出時点のOHLC足と
          人手での照合、十分な営業日後の結果検証が必要です。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
