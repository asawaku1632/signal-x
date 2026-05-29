export const marketData = [
  {
    code: "NVDA",
    name: "NVIDIA",
    price: 118.5,
    change: 3.4,
    score: 96,
    winRate: 87,
    risk: "中",
    stage: "上がりそう",
    pattern: "AI半導体"
  },
  {
    code: "BTC",
    name: "Bitcoin",
    price: 10300000,
    change: -1.8,
    score: 74,
    winRate: 58,
    risk: "高",
    stage: "危険",
    pattern: "仮想通貨変動"
  },
  {
    code: "TSLA",
    name: "Tesla",
    price: 177.4,
    change: 1.2,
    score: 81,
    winRate: 72,
    risk: "中",
    stage: "様子見",
    pattern: "EV関連"
  },
  {
    code: "AAPL",
    name: "Apple",
    price: 213.8,
    change: 2.1,
    score: 89,
    winRate: 79,
    risk: "低",
    stage: "上がりそう",
    pattern: "大型安定"
  },
  {
    code: "MSFT",
    name: "Microsoft",
    price: 441.3,
    change: 2.8,
    score: 92,
    winRate: 84,
    risk: "低",
    stage: "強い上昇",
    pattern: "AIクラウド"
  },
  {
    code: "META",
    name: "Meta",
    price: 512.2,
    change: -0.8,
    score: 73,
    winRate: 61,
    risk: "中",
    stage: "様子見",
    pattern: "SNS広告"
  },
  {
    code: "AMZN",
    name: "Amazon",
    price: 183.6,
    change: 1.7,
    score: 85,
    winRate: 76,
    risk: "低",
    stage: "買い注意",
    pattern: "EC関連"
  },
  {
    code: "GOOGL",
    name: "Google",
    price: 174.5,
    change: 0.9,
    score: 83,
    winRate: 75,
    risk: "低",
    stage: "様子見",
    pattern: "広告AI"
  },
  {
    code: "AMD",
    name: "AMD",
    price: 162.1,
    change: 4.4,
    score: 94,
    winRate: 85,
    risk: "中",
    stage: "強い上昇",
    pattern: "半導体急騰"
  },
  {
    code: "PLTR",
    name: "Palantir",
    price: 28.3,
    change: 5.7,
    score: 97,
    winRate: 91,
    risk: "高",
    stage: "強い上昇",
    pattern: "AI防衛"
  },

  {
    code: "7203",
    name: "トヨタ自動車",
    price: 3520,
    change: 1.8,
    score: 88,
    winRate: 79,
    risk: "低",
    stage: "上がりそう",
    pattern: "自動車強め"
  },
  {
    code: "4755",
    name: "楽天グループ",
    price: 912,
    change: 2.4,
    score: 84,
    winRate: 73,
    risk: "中",
    stage: "買い注意",
    pattern: "出来高増加"
  },
  {
    code: "6857",
    name: "アドバンテスト",
    price: 7420,
    change: 3.9,
    score: 95,
    winRate: 86,
    risk: "中",
    stage: "強い上昇",
    pattern: "AI半導体"
  },
  {
    code: "9984",
    name: "ソフトバンクグループ",
    price: 10800,
    change: -1.4,
    score: 71,
    winRate: 58,
    risk: "高",
    stage: "危険",
    pattern: "利確売り"
  },
  {
    code: "8306",
    name: "三菱UFJ",
    price: 1760,
    change: 0.9,
    score: 76,
    winRate: 69,
    risk: "低",
    stage: "様子見",
    pattern: "銀行安定"
  },
  {
    code: "6740",
    name: "ジャパンディスプレイ",
    price: 19,
    change: 6.2,
    score: 91,
    winRate: 82,
    risk: "高",
    stage: "強い上昇",
    pattern: "低位株急騰"
  },
  {
    code: "9432",
    name: "NTT",
    price: 171,
    change: 0.4,
    score: 68,
    winRate: 66,
    risk: "低",
    stage: "様子見",
    pattern: "通信安定"
  },
  {
    code: "7011",
    name: "三菱重工",
    price: 2840,
    change: 4.8,
    score: 94,
    winRate: 84,
    risk: "中",
    stage: "強い上昇",
    pattern: "防衛関連"
  }
];

export const watchRules = [
  "急騰検知",
  "急落警戒",
  "出来高急増",
  "AI注目",
  "買い強め",
  "売り注意",
  "大型株監視",
  "低位株監視"
];