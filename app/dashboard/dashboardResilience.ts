export type TodayMarketAvailability = {
  status?: string;
  topStock?: unknown | null;
};

export function isTodayMarketReady(
  httpStatus: number,
  data: TodayMarketAvailability | null,
) {
  return (
    httpStatus !== 202 &&
    data?.status !== "loading" &&
    data?.topStock != null
  );
}
