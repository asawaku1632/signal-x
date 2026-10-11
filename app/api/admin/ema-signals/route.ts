import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const tokyoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
});

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return response({ error: "管理者専用です" }, 403);

  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim().toUpperCase() ?? "";
  const range = params.get("range") === "6mo" ? "6mo" : "2y";
  if (!/^[0-9A-Z]{4}$/.test(code)) {
    return response({ error: "国内株式の4桁の銘柄コードを入力してください" }, 400);
  }

  try {
    const symbol = code + ".T";
    const target = "https://query1.finance.yahoo.com/v8/finance/chart/"
      + encodeURIComponent(symbol) + "?range=" + range + "&interval=1d&events=splits";
    const upstream = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return response({ error: "株価データの取得に失敗しました" }, 502);

    const payload = await upstream.json();
    const chart = payload?.chart?.result?.[0];
    const timestamps: unknown[] = chart?.timestamp ?? [];
    const quote = chart?.indicators?.quote?.[0];
    const rawSplits = chart?.events?.splits ?? {};
    const splitEvents: number[] = Object.values(rawSplits as Record<string, { date?: unknown }>)
      .map((event) => Number(event?.date))
      .filter((date) => Number.isFinite(date) && date > 0);
    if (!Array.isArray(timestamps) || !quote) {
      return response({ error: "日足データがありません" }, 404);
    }

    const candles: Candle[] = timestamps.flatMap((rawTime, i) => {
      const time = Number(rawTime);
      const open = Number(quote.open?.[i]);
      const high = Number(quote.high?.[i]);
      const low = Number(quote.low?.[i]);
      const close = Number(quote.close?.[i]);
      const volume = Number(quote.volume?.[i]);
      if (
        quote.open?.[i] == null || quote.high?.[i] == null ||
        quote.low?.[i] == null || quote.close?.[i] == null ||
        !Number.isFinite(time) || !Number.isFinite(open) ||
        !Number.isFinite(high) || !Number.isFinite(low) ||
        !Number.isFinite(close) || Math.min(open, high, low, close) <= 0
      ) return [];
      return [{ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 }];
    }).sort((a, b) => a.time - b.time).slice(-(range === "2y" ? 520 : 180));

    const now = new Date();
    const todayTokyo = tokyoDay.format(now);
    const tokyoClock = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    // The current trading day's candle can be incomplete before the JPX close.
    // Keep this observation strictly on closed daily candles.
    const excludedProvisionalBar =
      candles.length > 0 &&
      tokyoDay.format(new Date(candles[candles.length - 1].time * 1000)) === todayTokyo &&
      tokyoClock < "15:35";
    if (excludedProvisionalBar) candles.pop();

    if (candles.length < 22) {
      return response({ error: "EMA21の判定に必要な日足が不足しています" }, 404);
    }

    return response({
      success: true,
      code,
      timeframe: "1D",
      range,
      candles,
      splitEvents,
      provisionalBarExcluded: excludedProvisionalBar,
      fetchedAt: now.toISOString(),
    });
  } catch {
    return response({ error: "株価データの取得中にエラーが発生しました" }, 502);
  }
}
