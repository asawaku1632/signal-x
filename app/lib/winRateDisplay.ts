export type WinRateCounts = {
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
};

export type WinRateDisplayState =
  | "confirmed"
  | "provisional"
  | "waiting"
  | "no_direction"
  | "no_data";

export function calculateWinRate(win: number, lose: number): number | null {
  const denominator = win + lose;
  return denominator > 0 ? Math.round((win / denominator) * 100) : null;
}

export function getWinRateDisplay(counts: WinRateCounts) {
  const winRate = calculateWinRate(counts.win, counts.lose);
  let state: WinRateDisplayState;

  if (winRate !== null) {
    state = counts.unknown > 0 ? "provisional" : "confirmed";
  } else if (counts.unknown > 0) {
    state = "waiting";
  } else if (counts.hold > 0) {
    state = "no_direction";
  } else {
    state = "no_data";
  }

  const label =
    state === "provisional"
      ? `暫定 ${winRate}%`
      : state === "confirmed"
        ? `${winRate}%`
        : state === "waiting"
          ? "判定待ち"
          : state === "no_direction"
            ? "方向性判定なし"
            : "--";

  return {
    state,
    winRate,
    label,
    showBar: winRate !== null,
    detail:
      counts.unknown > 0
        ? `${counts.win}勝 ${counts.lose}敗 / 未判定${counts.unknown}件`
        : `${counts.win}勝 ${counts.lose}敗`,
  };
}

export function calculateConfirmedWinRateDiff(
  items: Array<Pick<WinRateCounts, "win" | "lose" | "unknown">>,
): number | null {
  const confirmedRates = items
    .filter((item) => item.unknown === 0 && item.win + item.lose > 0)
    .map((item) => calculateWinRate(item.win, item.lose))
    .filter((rate): rate is number => rate !== null);

  return confirmedRates.length >= 2
    ? confirmedRates.at(-1)! - confirmedRates.at(-2)!
    : null;
}
