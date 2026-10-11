import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import { usEconomicEvents, type UsEconomicEvent } from "@/app/lib/usEconomicEvents";

export const dynamic = "force-dynamic";

type Quote = { close: number; quoteDate: string; candleAt: string } | null;
type Observation = {
  event_key: string;
  observation_day_utc: string;
  observed_at: string;
  market_quotes: Record<string, Quote>;
};

const japanTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
  weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const SYMBOLS = [
  { key: "sp500", label: "S&P500" },
  { key: "nasdaq", label: "NASDAQ" },
  { key: "nikkei", label: "日経平均" },
  { key: "usdJpy", label: "ドル円" },
];

function priceText(quote: Quote | undefined): string {
  if (!quote || !Number.isFinite(quote.close) || quote.close <= 0) return "取得なし";
  return quote.close.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function EconomicEventCard({ event, now }: { event: UsEconomicEvent; now: number }) {
  const hours = (Date.parse(event.scheduledAt) - now) / 3_600_000;
  const near = hours <= 72;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">{event.title}</p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {japanTime.format(new Date(event.scheduledAt))}（日本時間）
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {near ? "⚠️ 72時間以内・値動きに注意" : "予定・観察のみ"}
          </p>
        </div>
        <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-xs font-black text-blue-600 underline">
          BLS公式 ↗
        </a>
      </div>
    </div>
  );
}

export default async function UsEconomicEventsPage() {
  const now = Date.now();
  const upcoming = usEconomicEvents.filter((event) => Date.parse(event.scheduledAt) >= now).slice(0, 10);
  const recent = usEconomicEvents.filter((event) => Date.parse(event.scheduledAt) < now).slice(-2).reverse();
  let observations: Observation[] = [];
  let historyAvailable = true;

  try {
    const result = await pool.query<Observation>(
      `SELECT event_key, observation_day_utc::text, observed_at::text, market_quotes
         FROM public.us_economic_market_observations
        ORDER BY observed_at DESC LIMIT 14`,
    );
    observations = result.rows;
  } catch {
    // The calendar is usable before the independent migration is applied.
    historyAvailable = false;
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-3 pt-4 lg:max-w-3xl lg:px-6">
        <Link href="/dashboard" className="text-sm font-bold text-blue-600">‹ ホームに戻る</Link>
        <p className="mt-3 text-[10px] font-black tracking-[.17em] text-blue-600">
          SIGNALX / US MACRO WATCH
        </p>
        <h1 className="mt-1 text-2xl font-black">🇺🇸 米国経済イベント</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          雇用統計とCPIの発表予定を日本時間で表示。発表前後に市場がどう動いたか、
          後で検証できるよう参考終値を独立して記録します。
        </p>

        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-black text-amber-900">⚠️ 重要指標発表前後は値動きに注意</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            発表結果や市場予想との比較、株価の上昇・下落を確約するものではありません。
            AI POWER・売買判定・LINE通知は変更しません。
          </p>
        </section>

        <section className="mt-5">
          <h2 className="text-lg font-black">📅 今後の発表予定</h2>
          <div className="mt-2 space-y-2">
            {upcoming.length > 0 ? (
              <>
                {upcoming.slice(0, 3).map((event) => (
                  <EconomicEventCard key={event.id} event={event} now={now} />
                ))}
                {upcoming.length > 3 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                      <span className="group-open:hidden">もっと見る（残り{upcoming.length - 3}件） ▼</span>
                      <span className="hidden group-open:inline">閉じる ▲</span>
                    </summary>
                    <div className="mt-2 space-y-2">
                      {upcoming.slice(3).map((event) => (
                        <EconomicEventCard key={event.id} event={event} now={now} />
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p className="rounded-xl bg-white p-3 text-sm">
                掲載済み日程は終了しました。BLS公式日程をご確認ください。
              </p>
            )}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mt-5">
            <h2 className="text-lg font-black">🕘 直近の予定時刻</h2>
            <div className="mt-2 rounded-2xl bg-white p-3 text-sm">
              {recent.map((event) => (
                <p key={event.id} className="py-1">
                  {event.title}：{japanTime.format(new Date(event.scheduledAt))}
                </p>
              ))}
              <p className="mt-2 text-xs text-slate-500">
                時刻が過ぎても実際の公表状況や結果は各公式ページで確認してください。
              </p>
            </div>
          </section>
        )}

        <section className="mt-5">
          <h2 className="text-lg font-black">📊 市場の記録（参考値）</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            発表日の前3日〜後5日の平日、原則1日1回の保存を予定。
            各市場の最終取引日が異なるため、株価の基準日も併記します。
          </p>
          {!historyAvailable ? (
            <p className="mt-2 rounded-xl bg-white p-3 text-sm">
              記録用データベースの準備・接続を確認中です。
            </p>
          ) : observations.length === 0 ? (
            <p className="mt-2 rounded-xl bg-white p-3 text-sm">
              まだ市場記録はありません。初回保存後に表示されます。
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {observations.map((row) => {
                const event = usEconomicEvents.find((item) => item.id === row.event_key);
                return (
                  <div key={row.event_key + row.observation_day_utc}
                    className="rounded-2xl border bg-white p-3">
                    <p className="text-sm font-black">{event?.title ?? "米国指標"}</p>
                    <p className="mb-2 mt-1 text-[11px] text-slate-500">
                      取得：{japanTime.format(new Date(row.observed_at))}（日本時間）
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {SYMBOLS.map((symbol) => {
                        const quote = row.market_quotes?.[symbol.key];
                        return (
                          <div key={symbol.key} className="rounded-lg bg-slate-50 p-2">
                            <p className="text-[11px] text-slate-500">{symbol.label}</p>
                            <p className="text-sm font-black">{priceText(quote)}</p>
                            <p className="text-[10px] text-slate-500">
                              {quote?.quoteDate ? "取引日 " + quote.quoteDate : "参照値なし"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            株価・為替はYahoo Financeの日足参考値です。取得遅延・後日修正の可能性があります。
            公表時刻・日付は米国労働統計局（BLS）の予定表をもとに登録しており、
            日程変更の自動同期はまだありません。正式日程はBLSで再確認してください。
          </p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
