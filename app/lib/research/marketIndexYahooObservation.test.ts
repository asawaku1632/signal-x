import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTimestampedMarketIndex } from "./marketIndexYahooObservation";

const capture = "2026-10-21T06:17:00.000Z";
const timestamp = Date.parse("2026-10-21T06:15:00.000Z") / 1000;
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockChart(symbol: string, time: number, price: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ chart: { result: [{
      meta: { symbol },
      timestamp: [time],
      indicators: { quote: [{ close: [price] }] },
    }] } }),
  } as unknown as Response);
}

describe("timestamped research-only index fetch", () => {
  it("accepts a fresh Nikkei observation with matching identity", async () => {
    mockChart("^N225", timestamp, 40000);
    const result = await fetchTimestampedMarketIndex("nikkei", capture);
    expect(result.status).toBe("observed");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("%5EN225"), expect.any(Object));
  });
  it("rejects a provider symbol mismatch", async () => {
    mockChart("998405.T", timestamp, 3000);
    expect((await fetchTimestampedMarketIndex("topix", capture)).status).toBe("missing");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("rejects stale prices even when numeric", async () => {
    mockChart("^N225", timestamp - 3600, 3000);
    expect((await fetchTimestampedMarketIndex("nikkei", capture)).status).toBe("stale");
  });
  it("rejects missing price without inventing a timestamp", async () => {
    mockChart("^N225", timestamp, Number.NaN);
    expect((await fetchTimestampedMarketIndex("nikkei", capture)).status).toBe("missing");
  });
  it("does not accept an HTTP error as an observation", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response);
    expect((await fetchTimestampedMarketIndex("nikkei", capture)).status).toBe("missing");
  });
});
