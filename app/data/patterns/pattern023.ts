export const pattern023 = {
  id: "pattern023",
  name: "EMA収束反発",
  direction: "buy",
  signal: "🟢 買い",
  winRate: 73,
  score: 25,
  importance: "★★★★☆",

  simpleMessage: "上に動き出す可能性があります",
  reason: "移動平均線が集まったあと、上方向へ反発しています",

  conditions: [
    "複数のEMAが近い位置に集まっている",
    "株価がEMA付近で下げ止まる",
    "陽線で反発し始める",
    "短期EMAが上向き始める",
  ],

  boostConditions: [
    "出来高増加",
    "長い下ヒゲ",
    "直近高値を更新",
    "地合いが強い",
  ],

  weakConditions: [
    "EMAを下抜ける",
    "出来高不足",
    "反発後すぐ陰線になる",
  ],

  beginnerText:
    "平均線が集まった場所で株価が止まり、上に反発し始める形です。上昇のきっかけになることがあります。",

  notification: {
    title: "🟢 買い",
    message: "平均線付近で反発しました",
    example:
      "7203 トヨタ\n🟢 買い\n勝率 73%\n「平均線付近で反発しました」",
  },
};