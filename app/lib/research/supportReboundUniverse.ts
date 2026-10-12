import { STOCKS } from "../stockList.ts";

/** Curated 100-stock basket from SIGNALX's stock list, not a random JPX sample.
 * No scheduled job, database persistence, trades, or automatic AI integration.
 */
export const SUPPORT_REBOUND_RESEARCH_BASKET = [
  // 自動車
  "7203",   "7267",   "7201",   "7270",   "7261",   "6902",
  // 金融
  "8306",   "8316",   "8411",   "8591",   "8604",   "8473",   "8766",   "8725",
  // 半導体関連
  "8035",   "6857",   "6723",   "6963",   "6988",
  // 電機・電子
  "6758",   "6501",   "6861",   "6981",   "6954",   "6503",   "6762",
  // 通信
  "9984",   "9432",   "9433",   "9434",   "4689",
  // 商社
  "8058",   "8001",   "8031",   "8053",   "8015",
  // 医薬品
  "4502",   "4503",   "4519",   "4568",   "4578",   "4543",
  // 小売
  "9983",   "3382",   "8267",   "3092",   "7532",   "9843",   "7453",
  // 鉄道
  "9020",   "9021",   "9022",   "9005",   "9007",
  // 鉄鋼
  "5401",   "5411",   "5406",
  // エネルギー
  "1605",   "5020",   "5019",   "9501",   "9502",   "9503",
  // 不動産
  "8801",   "8802",   "8830",   "3289",   "3003",
  // 食品
  "2502",   "2503",   "2802",   "2914",   "2269",   "2002",
  // ゲーム
  "7974",   "7832",   "9684",   "3659",   "9697",
  // その他
  "7011",   "7012",   "7013",   "6098",   "9101",   "9104",   "9107",   "4063",   "4901",   "6367",   "6702",   "5803",   "7014",   "4684",   "3778",   "5253",   "3402",   "3407",   "4188",   "5713",   "6301",
] as const;

const stockByCode = new Map(STOCKS.map((stock) => [stock.code, stock]));
export const SUPPORT_REBOUND_100 = SUPPORT_REBOUND_RESEARCH_BASKET.map((code) => ({
  code,
  name: stockByCode.get(code)?.name ?? code,
}));
export const SUPPORT_REBOUND_20 = SUPPORT_REBOUND_100.filter((_, index) => index % 5 === 0).slice(0, 20);
