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

export default function HomeStockSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  const results = useMemo(() => {
    const word = normalizeText(keyword);

    if (!word) return [];

    return STOCKS.filter((stock) => {
      const text = normalizeText(`${stock.code} ${stock.name}`);
      return text.includes(word);
    }).slice(0, 5);
  }, [keyword]);

  return (
    <div className="mt-6">
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="銘柄名・コードを検索（例：7203 / トヨタ）"
        className="w-full rounded-2xl bg-white border border-zinc-200 shadow-sm px-4 py-4 font-bold text-zinc-900 outline-none"
      />

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((stock, index) => (
            <button
              key={`${stock.code}-${stock.name}-${index}`}
              onClick={() => router.push(`/analysis/${stock.code}`)}
              className="w-full rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-left shadow-sm hover:bg-zinc-50"
            >
              <span className="font-black text-yellow-500">
                {stock.code}
              </span>
              <span className="ml-2 font-bold">{stock.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}