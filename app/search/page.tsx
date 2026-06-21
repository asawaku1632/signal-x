"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STOCKS } from "@/app/lib/stockList";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    );
}

function aliasText(code: string) {
  if (code === "6740") {
    return "ジャパンディスプレイ japan display jdi";
  }

  return "";
}

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  const uniqueStocks = useMemo(() => {
    const map = new Map<string, (typeof STOCKS)[number]>();

    for (const stock of STOCKS) {
      if (!map.has(stock.code)) {
        map.set(stock.code, stock);
      }
    }

    return Array.from(map.values());
  }, []);

  const filteredStocks = useMemo(() => {
    const word = normalizeText(keyword);

    if (!word) {
      return uniqueStocks.slice(0, 100);
    }

    return uniqueStocks
      .filter((stock) => {
        const text = normalizeText(
          `${stock.code} ${stock.name} ${aliasText(stock.code)}`
        );

        return text.includes(word);
      })
      .slice(0, 100);
  }, [keyword, uniqueStocks]);

  return (
    <main className="min-h-screen bg-black p-4 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-xl font-black text-cyan-300">
          🔍 銘柄検索
        </h1>

        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="コード・銘柄名で検索"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-bold text-white outline-none"
          />

          {keyword && (
            <button
              onClick={() => setKeyword("")}
              className="rounded-xl border border-zinc-700 px-3 py-3 text-sm font-bold text-zinc-300"
            >
              消
            </button>
          )}
        </div>

        <div className="space-y-2">
          {filteredStocks.map((stock, index) => (
            <button
              key={`${stock.code}-${stock.name}-${index}`}
              type="button"
              onClick={() => router.push(`/analysis/${stock.code}`)}
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left"
            >
              <div>
                <span className="font-black text-yellow-300">
                  {stock.code}
                </span>

                <span className="ml-2 font-bold text-white">
                  {stock.name}
                </span>
              </div>

              <span className="text-zinc-500">＞</span>
            </button>
          ))}
        </div>

        {keyword && filteredStocks.length === 0 && (
          <p className="mt-6 text-center text-sm font-bold text-zinc-500">
            該当銘柄がありません
          </p>
        )}
      </div>
    </main>
  );
}