export type SectorKey =
  | "AUTO"
  | "BANK"
  | "SEMICONDUCTOR"
  | "ELECTRONICS"
  | "TELECOM"
  | "TRADING_COMPANY"
  | "PHARMA"
  | "RETAIL"
  | "RAILWAY"
  | "STEEL"
  | "ENERGY"
  | "REAL_ESTATE"
  | "FOOD"
  | "GAME"
  | "OTHER";

export const sectorLabelMap: Record<SectorKey, string> = {
  AUTO: "自動車",
  BANK: "銀行・金融",
  SEMICONDUCTOR: "半導体",
  ELECTRONICS: "電機・精密",
  TELECOM: "通信",
  TRADING_COMPANY: "商社",
  PHARMA: "医薬品",
  RETAIL: "小売",
  RAILWAY: "鉄道",
  STEEL: "鉄鋼",
  ENERGY: "エネルギー",
  REAL_ESTATE: "不動産",
  FOOD: "食品",
  GAME: "ゲーム・娯楽",
  OTHER: "その他",
};

const sectorMap: Record<string, SectorKey> = {
  // 自動車
  "7203": "AUTO",
  "7267": "AUTO",
  "7201": "AUTO",
  "7269": "AUTO",
  "7270": "AUTO",
  "7211": "AUTO",

  // 銀行・金融
  "8306": "BANK",
  "8316": "BANK",
  "8411": "BANK",
  "8308": "BANK",
  "8309": "BANK",
  "8604": "BANK",
  "8591": "BANK",

  // 半導体
  "8035": "SEMICONDUCTOR",
  "6857": "SEMICONDUCTOR",
  "6146": "SEMICONDUCTOR",
  "6723": "SEMICONDUCTOR",
  "7735": "SEMICONDUCTOR",
  "3436": "SEMICONDUCTOR",
  "6526": "SEMICONDUCTOR",

  // 電機・精密
  "6501": "ELECTRONICS",
  "6758": "ELECTRONICS",
  "6861": "ELECTRONICS",
  "6954": "ELECTRONICS",
  "6971": "ELECTRONICS",
  "7751": "ELECTRONICS",
  "6594": "ELECTRONICS",
  "6503": "ELECTRONICS",

  // 通信
  "9432": "TELECOM",
  "9433": "TELECOM",
  "9434": "TELECOM",
  "9984": "TELECOM",

  // 商社
  "8058": "TRADING_COMPANY",
  "8001": "TRADING_COMPANY",
  "8031": "TRADING_COMPANY",
  "8053": "TRADING_COMPANY",
  "8015": "TRADING_COMPANY",

  // 医薬品
  "4502": "PHARMA",
  "4503": "PHARMA",
  "4519": "PHARMA",
  "4568": "PHARMA",
  "4578": "PHARMA",

  // 小売
  "9983": "RETAIL",
  "3382": "RETAIL",
  "8267": "RETAIL",
  "3092": "RETAIL",
  "7532": "RETAIL",

  // 鉄道
  "9020": "RAILWAY",
  "9021": "RAILWAY",
  "9022": "RAILWAY",
  "9005": "RAILWAY",
  "9007": "RAILWAY",

  // 鉄鋼
  "5401": "STEEL",
  "5411": "STEEL",
  "5406": "STEEL",

  // エネルギー
  "1605": "ENERGY",
  "5020": "ENERGY",
  "5019": "ENERGY",
  "9501": "ENERGY",
  "9502": "ENERGY",
  "9503": "ENERGY",

  // 不動産
  "8801": "REAL_ESTATE",
  "8802": "REAL_ESTATE",
  "8830": "REAL_ESTATE",
  "3289": "REAL_ESTATE",

  // 食品
  "2502": "FOOD",
  "2503": "FOOD",
  "2802": "FOOD",
  "2914": "FOOD",
  "2269": "FOOD",

  // ゲーム・娯楽
  "7974": "GAME",
  "7832": "GAME",
  "9684": "GAME",
  "3659": "GAME",
};

export function getSectorKey(code: string): SectorKey {
  return sectorMap[String(code)] ?? "OTHER";
}

export function getSectorLabel(code: string): string {
  return sectorLabelMap[getSectorKey(code)];
}