"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function getPower(stock: Stock) {
  return stock.score ?? stock.aiPower ?? 0;
}

function getJudge(power: number) {
  if (power >= 80) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeColor(power: number) {
  if (power >= 80) return "bg-green-100 text-green-700";
  if (power >= 75) return "bg-blue-100 text-blue-700";
  if (power >= 65) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      const saved = localStorage.getItem("signalx-favorites");
      const favoriteCodes: string[] = saved ? JSON.parse(saved) : [];

      if (!favoriteCodes.length) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/scan?limit=1000", {
        cache: "no-store",
      });

      const data = await res.json();
      const stocks: Stock[] = data.stocks || [];

      const selected = favoriteCodes
        .map((code) => stocks.find((stock) => stock.code === code))
        .filter(Boolean) as Stock[];

      setFavorites(selected);
    } catch (error) {
      console.error("favorites load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = (code: string) => {
    const saved = localStorage.getItem("signalx-favorites");
    const favoriteCodes: string[] = saved ? JSON.parse(saved) : [];

    const updated = favoriteCodes.filter((item) => item !== code);

    localStorage.setItem("signalx-favorites", JSON.stringify(updated));
    setFavorites((prev) => prev.filter((stock) => stock.code !== code));
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              お気に入りを読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              FAVORITES
            </div>
          </div>

          <button
            onClick={loadFavorites}
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"
          >
            ↻
          </button>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-yellow-50 border border-yellow-200 p-4 mb-4 shadow-sm">
          <p className="text-sm font-black text-yellow-600">⭐ お気に入り</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <h1 className="text-4xl font-black">{favorites.length}</h1>
              <p className="text-sm font-bold text-slate-500">
                登録銘柄をAIが監視
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-500">監視状態</p>
              <p className="text-xl font-black text-green-600">ON</p>
            </div>
          </div>
        </section>

        {favorites.length === 0 ? (
          <section className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm text-center">
            <p className="text-4xl mb-3">☆</p>
            <h2 className="text-xl font-black">お気に入りはまだありません</h2>
            <p className="text-sm text-slate-500 font-bold mt-2 leading-6">
              分析ページ右上の☆を押すと、ここに登録されます。
            </p>

            <Link
              href="/today-market"
              className="block mt-4 rounded-2xl bg-blue-600 text-white py-3 font-black"
            >
              今日の市場から探す
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {favorites.map((stock) => {
              const power = getPower(stock);
              const judge = getJudge(power);

              return (
                <div
                  key={stock.code}
                  className="rounded-[24px] bg-white border border-slate-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/analysis/${stock.code}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black">
                          {stock.code}
                        </h2>
                        <span
                          className={`text-xs font-black px-2 py-1 rounded-lg ${getJudgeColor(
                            power
                          )}`}
                        >
                          {judge}
                        </span>
                      </div>

                      <p className="text-lg font-black truncate">
                        {stock.name}
                      </p>

                      <p className="text-xs text-slate-500 font-bold mt-1 truncate">
                        {stock.reason || "AI理由なし"}
                      </p>
                    </Link>

                    <button
                      onClick={() => removeFavorite(stock.code)}
                      className="w-10 h-10 rounded-2xl bg-yellow-400 text-white font-black text-xl"
                    >
                      ★
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Mini label="AI" value={String(power)} />
                    <Mini label="現在値" value={yen(stock.price)} />
                    <Mini
                      label="変化率"
                      value={`${stock.changePercent ?? 0}%`}
                    />
                  </div>

                  <Link
                    href={`/chart/${stock.code}`}
                    className="block mt-3 rounded-2xl bg-slate-900 text-white text-center py-3 font-black"
                  >
                    📈 チャートを見る
                  </Link>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" active />
    </div>
    </nav>
  );
}

function Nav({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={active ? "text-center text-xs font-bold text-blue-600" : "text-center text-xs font-bold text-slate-500"}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}



