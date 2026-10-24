import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 5_000;

type FinnhubQuote = {
  c?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function fetchQuote(symbol: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const endpoint = new URL("https://finnhub.io/api/v1/quote");
    endpoint.searchParams.set("symbol", symbol);
    endpoint.searchParams.set("token", apiKey);

    const response = await fetch(endpoint, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { symbol, ok: false as const, error: `HTTP_${response.status}` };
    }

    const data = (await response.json()) as FinnhubQuote;
    if (!validPrice(data.c)) {
      return { symbol, ok: false as const, error: "NO_VALID_PRICE" };
    }

    return {
      symbol,
      ok: true as const,
      price: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
      providerTimestamp: data.t ?? null,
    };
  } catch (error) {
    return {
      symbol,
      ok: false as const,
      error: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "FETCH_FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "QUOTE_PROVIDER_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const rawCode = new URL(request.url).pathname.split("/").pop() ?? "";
  const code = decodeURIComponent(rawCode).trim().toUpperCase();
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { success: false, error: "INVALID_STOCK_CODE" },
      { status: 400 },
    );
  }

  // Tokyo symbols are attempted first. Keep fallbacks for provider compatibility,
  // but stop immediately after the first valid quote instead of always making 4 calls.
  const candidates = [`${code}.T`, code, `${code}.TSE`, `${code}.JP`];
  const attempts: Array<{ symbol: string; error: string }> = [];

  for (const symbol of candidates) {
    const result = await fetchQuote(symbol, apiKey);
    if (result.ok) {
      return NextResponse.json({
        success: true,
        code,
        quote: result,
        asOf: new Date().toISOString(),
      });
    }
    attempts.push({ symbol, error: result.error });
  }

  return NextResponse.json(
    { success: false, code, error: "QUOTE_NOT_AVAILABLE", attempts },
    { status: 502 },
  );
}
