export const pattern005 = {
  id: "pattern005",
  name: "出来高急増ブレイク",
  direction: "buy",
  signal: "🟢 超強い買い",
  winRate: 79,
  score: 32,
  importance: "★★★★★",

  simpleMessage: "強い買いが集まっています",
  reason: "出来高を伴って大きく動き始めています",

  conditions: [
    "出来高が急増している",
    "大陽線が発生している",
    "高値を更新している",
    "一気に買いが入っている",
  ],

  boostConditions: [
    "ニュース材料あり",
    "連続陽線",
    "寄付き後すぐ急騰",
    "日経平均も強い",
  ],

  weakConditions: [
    "長い上ヒゲ",
    "急騰後すぐ失速",
    "出来高だけ増えて上がらない",
  ],

  beginnerText:
    "普段より大きなお金が入り、株価が強く動き始めた形です。急騰の初動になることがあります。",

  notification: {
    title: "🟢 超強い買い",
    message: "強い資金流入を検知しました",
    example:
      "7011 三菱重工\n🟢 超強い買い\n勝率 79%\n「強い資金流入を検知しました」",
  },
};