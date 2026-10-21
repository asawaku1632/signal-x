// Manual, read-only research diagnostic. Never persists observations or places orders.
const symbols = { nikkei: "^N225", topix_998405: "998405.T", topix_topx: "^TOPX", topix_topix: "^TOPIX", topix_tpx: "^TPX" };
for (const [index, symbol] of Object.entries(symbols)) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1d&interval=1m";
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.log(JSON.stringify({ index, requestedSymbol: symbol, status: "http_error", httpStatus: response.status }));
      continue;
    }
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const returnedSymbol = result?.meta?.symbol ?? null;
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    let latest = null;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (Number.isFinite(timestamps[i]) && Number.isFinite(closes[i]) && closes[i] > 0) {
        latest = { observedAt: new Date(timestamps[i] * 1000).toISOString(), value: closes[i] };
        break;
      }
    }
    console.log(JSON.stringify({
      index, requestedSymbol: symbol, returnedSymbol,
      status: returnedSymbol !== symbol ? "symbol_mismatch" : latest ? "timestamped_bar_found" : "no_valid_bar",
      latest, capturedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.log(JSON.stringify({ index, requestedSymbol: symbol, status: "network_error", reason: String(error?.message ?? error) }));
  }
}
