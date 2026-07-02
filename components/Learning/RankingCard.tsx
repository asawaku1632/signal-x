import Link from "next/link";

export type StockRanking = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  winRate: number;
};

type RankingCardProps = {
  title: string;
  stocks: StockRanking[];
  emptyText: string;
  type: "best" | "worst";
};

export default function RankingCard({
  title,
  stocks,
  emptyText,
  type,
}: RankingCardProps) {
  const average =
    stocks.length === 0
      ? 0
      : Math.round(
          stocks.reduce((sum, stock) => sum + stock.winRate, 0) / stocks.length
        );

  return (
    <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black">{title}</h2>
        {stocks.length > 0 && (
          <span
            className={`text-xs font-black px-3 py-1 rounded-full ${
              type === "best"
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-red-50 text-red-500 border border-red-100"
            }`}
          >
            平均 {average}%
          </span>
        )}
      </div>

      {stocks.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-sm font-bold text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stocks.map((stock, index) => (
            <Link
              key={stock.code}
              href={`/analysis/${stock.code}`}
              className={`block rounded-2xl border p-3 active:scale-[0.98] transition ${
                type === "best"
                  ? "bg-green-50/40 border-green-100"
                  : "bg-red-50/40 border-red-100"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      type === "best"
                        ? "bg-green-600 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-400">
                      {stock.code}
                    </p>
                    <p className="text-sm font-black text-slate-800 truncate">
                      {stock.name}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-xl font-black ${
                      type === "best" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {stock.winRate}%
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    {stock.total}件学習　›
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}