import { describe, expect, it } from "vitest";
import { validateMarketIndexSnapshot } from "./marketIndexShadowContract";

const base = {
  index: "topix" as const,
  value: 3000.5,
  observedAt: "2026-10-21T06:15:00.000Z",
  capturedAt: "2026-10-21T06:17:00.000Z",
  source: "timestamped-test-feed",
};

describe("market index shadow contract", () => {
  it("accepts a same-session recent observation", () => {
    const result = validateMarketIndexSnapshot(base);
    expect(result.status).toBe("observed");
    if (result.status === "observed") {
      expect(result.sessionDateJst).toBe("2026-10-21");
      expect(result.value).toBe(3000.5);
    }
  });
  it("rejects missing source timestamp", () => {
    expect(validateMarketIndexSnapshot({ ...base, observedAt: null }).status).toBe("missing");
  });
  it("rejects zero or nonnumeric index value", () => {
    expect(validateMarketIndexSnapshot({ ...base, value: 0 }).status).toBe("invalid");
    expect(validateMarketIndexSnapshot({ ...base, value: "3000" }).status).toBe("invalid");
  });
  it("rejects stale observations", () => {
    expect(validateMarketIndexSnapshot({ ...base, observedAt: "2026-10-21T05:00:00Z" }).status).toBe("stale");
  });
  it("rejects next-day observations", () => {
    expect(validateMarketIndexSnapshot({ ...base, observedAt: "2026-10-20T06:15:00Z" }).status).toBe("stale");
  });
  it("rejects future observations", () => {
    expect(validateMarketIndexSnapshot({ ...base, observedAt: "2026-10-21T06:25:00Z" }).status).toBe("future_timestamp");
  });
});
