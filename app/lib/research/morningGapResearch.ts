/**
 * SIGNALX independent morning VWAP backtest. Client-only calculations.
 * Input bars are JST 5-minute START times. 09:00 means 09:00 to 09:05.
 * No automatic data collection, trade execution, DB writes, or model signals.
 */
export type MorningBar = {
  code: string;
  date: string;
  time: string;
  minute: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose: number;
};

export type MorningOptions = {
  minGapPct: number;
  maxGapPct: number;
  minFirst30Volume: number;
  takeProfitPct: number;
  stopLossPct: number;
  slippageBps: number;
  roundTripFeeYen: number;
  shares: number;
};

export type StrategyId = "gap" | "last3" | "all6";
export type MorningTrade = {
  code: string;
  date: string;
  strategy: StrategyId;
  gapPct: number;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  netYen: number;
  netPct: number;
  reason: string;
};
export type MorningStats = {
  trades: number;
  wins: number;
  winRate: number | null;
  avgNetPct: number | null;
  avgYen: number | null;
  totalYen: number;
  profitFactor: number | null;
};

export type MorningReport = {
  totalGroups: number;
  completeGroups: number;
  skipped: Array<{ code: string; date: string; reason: string }>;
  examined: Array<{
    code: string;
    date: string;
    gapPct: number;
    firstVolume: number;
    baseEligible: boolean;
    aboveLast3: boolean;
    aboveAll6: boolean;
  }>;
  strategies: Array<{ id: StrategyId; label: string; stats: MorningStats; trades: MorningTrade[] }>;
};

const FIRST_MINUTE = 9 * 60;
const ENTRY_MINUTE = FIRST_MINUTE + 30;
const LAST_MINUTE = 10 * 60 + 25;
const REQUIRED_COUNT = (LAST_MINUTE - FIRST_MINUTE) / 5 + 1;
const HEADER = ["code", "date", "time", "open", "high", "low", "close", "volume", "prev_close"] as const;

export const MORNING_STRATEGIES: Array<{ id: StrategyId; label: string }> = [
  { id: "gap", label: "比較用：ギャップのみ" },
  { id: "last3", label: "VWAP直近3本維持" },
  { id: "all6", label: "VWAP最初の6本すべて維持" },
];

export const MORNING_DEFAULTS: Readonly<MorningOptions> = Object.freeze({
  minGapPct: 2, maxGapPct: 8, minFirst30Volume: 100000,
  takeProfitPct: 2, stopLossPct: 1, slippageBps: 10,
  roundTripFeeYen: 0, shares: 100,
});

function csvRecords(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell.trim()); cell = ""; }
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) records.push(row);
      row = [];
    } else cell += c;
  }
  if (quoted) throw new Error("CSVの引用符が閉じていません。");
  row.push(cell.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
}

function minuteOf(time: string, rowNumber: number): number {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(`${rowNumber}行目：時刻は09:00形式で入力してください。`);
  const hh = Number(time.slice(0, 2)), mm = Number(time.slice(3, 5));
  if (hh > 23 || mm > 59 || mm % 5 !== 0) throw new Error(`${rowNumber}行目：時刻はJSTの5分刻みで入力してください。`);
  return hh * 60 + mm;
}

export function parseMorningCSV(text: string): MorningBar[] {
  const rows = csvRecords(text);
  if (rows.length < 2) throw new Error("CSVのヘッダーと株価データを入力してください。");
  const headings = rows.shift()!.map((name) => name.trim().toLowerCase());
  if (new Set(headings).size !== headings.length) throw new Error("CSVの列名が重複しています。");
  const missing = HEADER.filter((name) => !headings.includes(name));
  if (missing.length) throw new Error(`CSVの必須列が不足：${missing.join(", ")}`);
  const observed = new Set<string>();
  return rows.map((values, index) => {
    const rowNo = index + 2;
    const field = (name: typeof HEADER[number]) => values[headings.indexOf(name)] ?? "";
    const code = field("code"), date = field("date"), time = field("time");
    if (!/^[0-9A-Za-z.\-]{2,18}$/.test(code)) throw new Error(`${rowNo}行目：銘柄コードが不正です。`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z")) || new Date(date + "T00:00:00Z").toISOString().slice(0,10) !== date) {
      throw new Error(`${rowNo}行目：日付はYYYY-MM-DDで入力してください。`);
    }
    const minute = minuteOf(time, rowNo);
    const key = `${code}|${date}|${time}`;
    if (observed.has(key)) throw new Error(`${rowNo}行目：同一銘柄・日付・5分足が重複しています。`);
    observed.add(key);
    const num = (name: typeof HEADER[number]): number => {
      const raw = field(name);
      if (!raw || !Number.isFinite(Number(raw))) throw new Error(`${rowNo}行目：${name}が数値ではありません。`);
      return Number(raw);
    };
    const open = num("open"), high = num("high"), low = num("low");
    const close = num("close"), volume = num("volume"), prevClose = num("prev_close");
    if (Math.min(open, high, low, close, prevClose) <= 0 || volume < 0 || !Number.isInteger(volume) || low > Math.min(open, close) || high < Math.max(open, close) || low > high) {
      throw new Error(`${rowNo}行目：始値・高値・安値・終値・出来高に矛盾があります。`);
    }
    return { code, date, time, minute, open, high, low, close, volume, prevClose };
  });
}

export function normalizeMorningOptions(input: Partial<MorningOptions> = {}): MorningOptions {
  const options = { ...MORNING_DEFAULTS, ...input };
  for (const key of Object.keys(options) as Array<keyof MorningOptions>) {
    if (!Number.isFinite(options[key]) || options[key] < 0) throw new Error(`設定「${key}」は0以上の数字にしてください。`);
  }
  if (options.minGapPct > options.maxGapPct || options.takeProfitPct <= 0 || options.stopLossPct <= 0 || options.stopLossPct >= 100 || options.slippageBps >= 1000 || options.shares < 1 || !Number.isInteger(options.shares)) {
    throw new Error("利確・損切り・ギャップ・株数の設定を確認してください。");
  }
  return options;
}

export function intradayVWAP(bars: Pick<MorningBar, "high" | "low" | "close" | "volume">[]): Array<number | null> {
  let pv = 0, quantity = 0;
  return bars.map((bar) => {
    pv += ((bar.high + bar.low + bar.close) / 3) * bar.volume;
    quantity += bar.volume;
    return quantity > 0 ? pv / quantity : null;
  });
}

function simulateTrade(bars: MorningBar[], opts: MorningOptions, strategy: StrategyId, gapPct: number): MorningTrade {
  const entryIndex = (ENTRY_MINUTE - FIRST_MINUTE) / 5;
  const entry = bars[entryIndex];
  const entryPrice = entry.open * (1 + opts.slippageBps / 10000);
  const target = entryPrice * (1 + opts.takeProfitPct / 100);
  const stop = entryPrice * (1 - opts.stopLossPct / 100);
  let rawExit = bars[bars.length - 1].close;
  let exitTime = "10:30", reason = "10:30に手仕舞い（仮定）";
  for (let i = entryIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    if (bar.open <= stop) { rawExit = bar.open; exitTime = bar.time; reason = "始値が損切り線以下"; break; }
    const hitStop = bar.low <= stop, hitTarget = bar.high >= target;
    // 5m OHLC cannot tell which event came first: conservative stop-first.
    if (hitStop) { rawExit = stop; exitTime = bar.time; reason = hitTarget ? "同一足で利確・損切り両方到達→損切り優先" : "損切り"; break; }
    if (hitTarget) { rawExit = target; exitTime = bar.time; reason = "利確"; break; }
  }
  const exitPrice = rawExit * (1 - opts.slippageBps / 10000);
  const netYen = (exitPrice - entryPrice) * opts.shares - opts.roundTripFeeYen;
  return {
    code: entry.code, date: entry.date, strategy, gapPct,
    entryTime: "09:30", exitTime, entryPrice, exitPrice, netYen,
    netPct: 100 * netYen / (entryPrice * opts.shares), reason,
  };
}

function summarize(trades: MorningTrade[]): MorningStats {
  const positive = trades.filter((trade) => trade.netYen > 0);
  const gains = positive.reduce((sum, trade) => sum + trade.netYen, 0);
  const losses = -trades.filter((trade) => trade.netYen < 0).reduce((sum, trade) => sum + trade.netYen, 0);
  const totalYen = trades.reduce((sum, trade) => sum + trade.netYen, 0);
  return {
    trades: trades.length, wins: positive.length,
    winRate: trades.length ? 100 * positive.length / trades.length : null,
    avgNetPct: trades.length ? trades.reduce((sum, trade) => sum + trade.netPct, 0) / trades.length : null,
    avgYen: trades.length ? totalYen / trades.length : null,
    totalYen, profitFactor: losses > 0 ? gains / losses : (gains > 0 ? Infinity : null),
  };
}

export function runMorningResearch(input: string | MorningBar[], inputOptions: Partial<MorningOptions> = {}): MorningReport {
  const options = normalizeMorningOptions(inputOptions);
  const bars = typeof input === "string" ? parseMorningCSV(input) : input;
  const groups = new Map<string, MorningBar[]>();
  for (const bar of bars) {
    const key = `${bar.code}|${bar.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bar);
  }
  const trades: Record<StrategyId, MorningTrade[]> = { gap: [], last3: [], all6: [] };
  const skipped: MorningReport["skipped"] = [];
  const examined: MorningReport["examined"] = [];
  for (const [key, group] of groups) {
    const [code, date] = key.split("|");
    group.sort((a, b) => a.minute - b.minute);
    if (group.length !== REQUIRED_COUNT || !group.every((bar, index) => bar.minute === FIRST_MINUTE + 5 * index)) {
      skipped.push({ code, date, reason: "09:00〜10:25開始の5分足18本が揃っていません。" });
      continue;
    }
    if (!group.every((bar) => Math.abs(bar.prevClose - group[0].prevClose) < 0.000001)) {
      skipped.push({ code, date, reason: "同じ日の前営業日終値が一致しません。" });
      continue;
    }
    const first6 = group.slice(0, 6);
    const gapPct = 100 * (first6[0].open / first6[0].prevClose - 1);
    const firstVolume = first6.reduce((sum, bar) => sum + bar.volume, 0);
    const vwaps = intradayVWAP(first6);
    const above = first6.map((bar, i) => vwaps[i] !== null && bar.close > vwaps[i]);
    const aboveLast3 = above.slice(3).every(Boolean);
    const aboveAll6 = above.every(Boolean);
    const baseEligible = gapPct >= options.minGapPct && gapPct <= options.maxGapPct && firstVolume >= options.minFirst30Volume;
    examined.push({ code, date, gapPct, firstVolume, aboveLast3, aboveAll6, baseEligible });
    if (baseEligible) trades.gap.push(simulateTrade(group, options, "gap", gapPct));
    if (baseEligible && aboveLast3) trades.last3.push(simulateTrade(group, options, "last3", gapPct));
    if (baseEligible && aboveAll6) trades.all6.push(simulateTrade(group, options, "all6", gapPct));
  }
  return {
    totalGroups: groups.size, completeGroups: examined.length, skipped, examined,
    strategies: MORNING_STRATEGIES.map(({ id, label }) => ({ id, label, stats: summarize(trades[id]), trades: trades[id] })),
  };
}

export function makeSingleMorningCSV(code: string, date: string, prevClose: number, lines: string): string {
  const raw = lines.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (raw.length !== REQUIRED_COUNT) throw new Error("5分足は09:00〜10:25の18行が必要です。");
  const rows = raw.map((line, i) => {
    const parts = line.split(/[\t,]/).map((cell) => cell.trim());
    if (parts.length !== 6) throw new Error(`${i + 1}行目は 時刻,始値,高値,安値,終値,出来高 の6列にしてください。`);
    return [code.trim(), date.trim(), ...parts, String(prevClose)].join(",");
  });
  const csv = `${HEADER.join(",")}\n${rows.join("\n")}`;
  parseMorningCSV(csv);
  return csv;
}

export function appendMorningCSV(existing: string, addition: string): string {
  const entries = parseMorningCSV(addition);
  if (new Set(entries.map((b) => `${b.code}|${b.date}`)).size !== 1) throw new Error("追加できるのは1銘柄・1営業日ずつです。");
  if (!existing.trim()) return addition.trim();
  const before = parseMorningCSV(existing);
  const id = `${entries[0].code}|${entries[0].date}`;
  if (before.some((b) => `${b.code}|${b.date}` === id)) throw new Error("同じ銘柄・同じ日付のデータがすでに入っています。先に既存データを確認してください。");
  return `${existing.trim()}\n${addition.split(/\r?\n/).slice(1).join("\n")}`;
}