export const pattern032 = {
  id: "pattern032",
  name: "出来高伴う暴落",
  direction: "sell",
  signal: "🔴 強い下落警戒",
  winRate: 80,
  score: 34,
  importance: "★★★★★",

  simpleMessage: "強い売りに注意です",
  reason: "出来高を伴って大きく売られています",

  conditions: [
    "株価が大きく下落している",
    "出来高が急増している",
    "大陰線が出ている",
    "終値が安値付近で終わっている",
  ],

  boostConditions: [
    "重要ラインを割っている",
    "悪材料ニュースあり",
    "移動平均線を下抜け",
    "地合いが弱い",
  ],

  weakConditions: [
    "長い下ヒゲで戻す",
    "翌足で反発",
    "出来高が続かない",
  ],

  beginnerText:
    "大きなお金が売りに回り、株価が強く下がっている形です。さらに下落が続くことがあります。",

  notification: {
    title: "🔴 強い下落警戒",
    message: "強い売りを検知しました",
    example:
      "7203 トヨタ\n🔴 強い下落警戒\n勝率 80%\n「強い売りを検知しました」",
  },
};