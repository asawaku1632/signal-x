/**
 * STEP 361-380: conservative readiness display for index research.
 * This is NOT an authorization gate for writes or market-data ingestion.
 * Caller flags are untrusted; no combination enables production.
 */
export type ReadinessInput = {
  providerRightsVerified: unknown;
  licensedEvidenceAuthenticated: unknown;
  exchangeCalendarAuthenticated: unknown;
  observedMarketDataValidated: unknown;
  scheduledCaptureConfigured: unknown;
  databasePersistenceConfigured: unknown;
};
export type ReadinessItem = {
  code: "RIGHTS" | "CALENDAR" | "MARKET_DATA" | "SCHEDULE" | "RESEARCH_DB";
  label: string;
  state: "blocked" | "configured_unverified";
  explanation: string;
};
export type ReadinessReport = {
  mode: "research_only";
  productionEnabled: false;
  officialPersistenceEnabled: false;
  allIndependentEvidenceVerified: false;
  items: ReadinessItem[];
  blockers: string[];
};
export function summarizeMarketIndexReadiness(input: ReadinessInput): ReadinessReport {
  const obj = input && typeof input === "object" && !Array.isArray(input) ? input : {} as ReadinessInput;
  const items: ReadinessItem[] = [
    { code: "RIGHTS", label: "提供元の利用許諾",
      state: obj.providerRightsVerified === true && obj.licensedEvidenceAuthenticated === true ? "configured_unverified" : "blocked",
      explanation: "契約書・利用範囲・失効状況を独立確認するまで正式利用できません。" },
    { code: "CALENDAR", label: "取引日カレンダー",
      state: obj.exchangeCalendarAuthenticated === true ? "configured_unverified" : "blocked",
      explanation: "権威ある取引所カレンダーと臨時休場を独立検証する必要があります。" },
    { code: "MARKET_DATA", label: "正式指数値と鮮度",
      state: obj.observedMarketDataValidated === true ? "configured_unverified" : "blocked",
      explanation: "取得元・日時・価格値・欠損を独立検証する必要があります。" },
    { code: "SCHEDULE", label: "定時取得",
      state: obj.scheduledCaptureConfigured === true ? "configured_unverified" : "blocked",
      explanation: "スケジュール設定だけでは許諾や正常取得を証明できません。" },
    { code: "RESEARCH_DB", label: "研究DB保存設定",
      state: obj.databasePersistenceConfigured === true ? "configured_unverified" : "blocked",
      explanation: "研究DBの保存設定は正式データの保存許可とは別です。" },
  ];
  return {
    mode: "research_only",
    productionEnabled: false,
    officialPersistenceEnabled: false,
    allIndependentEvidenceVerified: false,
    items,
    blockers: items.filter(x => x.state === "blocked").map(x => x.code),
  };
}
