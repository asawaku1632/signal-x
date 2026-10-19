// Research-only presentation of already-settled, AI-POWER-only swing cohorts.
// Do not feed this into live decisions, notifications or simulated trades.
export type SwingHistoricalOutcome = {
  days: number;
  checked: number;
  averageReturnPercent: number | null;
};

export type SwingHistoricalGroup = {
  status: string;
  count: number;
  distinctDates: number;
  outcomes: SwingHistoricalOutcome[];
};

export type SwingEvidenceStatus = "NO_DATA" | "CAUTION" | "COLLECTING" | "REFERENCE";

const MIN_DISTINCT_PREDICTION_DAYS = 20;
const MIN_COMPLETED_EACH = 200;
const MIN_CAUTION_SAMPLES = 30;

function positiveCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function validReturn(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function summarizeSwingHistoricalEvidence(group: SwingHistoricalGroup | null | undefined) {
  const count = positiveCount(group?.count);
  const distinctDates = positiveCount(group?.distinctDates);
  const horizons = ([3, 5] as const).map((days) => {
    const row = group?.outcomes?.find((item) => item.days === days);
    const checked = positiveCount(row?.checked);
    return {
      days,
      checked,
      averageReturnPercent: checked ? validReturn(row?.averageReturnPercent) : null,
    };
  });
  const observed = horizons.some((row) => row.averageReturnPercent !== null);
  const negative = horizons.some(
    (row) => row.checked >= MIN_CAUTION_SAMPLES &&
      row.averageReturnPercent !== null && row.averageReturnPercent < 0,
  );
  const enoughHistory = distinctDates >= MIN_DISTINCT_PREDICTION_DAYS &&
    horizons.every((row) => row.checked >= MIN_COMPLETED_EACH && row.averageReturnPercent !== null);
  const status: SwingEvidenceStatus = !observed ? "NO_DATA" :
    negative ? "CAUTION" : enoughHistory ? "REFERENCE" : "COLLECTING";
  return { count, distinctDates, horizons, status, enoughHistory };
}
