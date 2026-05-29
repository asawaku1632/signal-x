export const pattern028 = {
  id: "pattern028",
  name: "寄付き急騰継続",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 74,
  score: 27,
  importance: "★★★★☆",

  simpleMessage: "朝から強い買いが入っています",
  reason: "寄付き直後から上昇し、その勢いが続いています",

  conditions: [
    "寄付き直後に大きく上昇している",
    "高値圏を維持している",
    "押し目が浅い",
    "出来高が増えている",
  ],

  boostConditions: [
    "好材料ニュースあり",
    "日経平均も強い",
    "高値更新が続く",
    "大陽線で推移している",
  ],

  weakConditions: [
    "寄付き後すぐ失速",
    "長い上ヒゲ",
    "出来高が続かない",
  ],

  beginnerText:
    "朝から強く買われ、その後も勢いが続いている形です。短期的な上昇が続くことがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "朝の急騰継続を検知しました",
    example:
      "7011 三菱重工\n🟢 強い買い\n勝率 74%\n「朝の急騰継続を検知しました」",
  },
};