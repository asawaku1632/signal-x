export const pattern027 = {
  id: "pattern027",
  name: "GU窓開け継続",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 75,
  score: 28,
  importance: "★★★★★",

  simpleMessage: "上昇継続の可能性があります",
  reason: "前日より高く始まり、そのまま買いが続いています",

  conditions: [
    "前日終値より高く寄り付いている",
    "窓を開けて上昇している",
    "寄付き後も高値を維持している",
    "陰線で大きく崩れていない",
  ],

  boostConditions: [
    "出来高増加",
    "好材料ニュースあり",
    "寄付き後にさらに高値更新",
    "地合いが強い",
  ],

  weakConditions: [
    "寄付き後すぐ窓埋めする",
    "長い上ヒゲが出る",
    "出来高が少ない",
  ],

  beginnerText:
    "前日より高い価格で始まり、そのまま強さを保っている形です。買いの勢いが続くことがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "窓開け上昇が続いています",
    example:
      "8035 東京エレクトロン\n🟢 強い買い\n勝率 75%\n「窓開け上昇が続いています」",
  },
};