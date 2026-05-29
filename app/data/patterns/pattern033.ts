export const pattern033 = {
  id: "pattern033",
  name: "急騰後大陰線",
  direction: "sell",
  signal: "🔴 強い下落警戒",
  winRate: 77,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "反落に注意です",
  reason: "急騰後に強い売りが入り、流れが崩れ始めています",

  conditions: [
    "直前に急騰している",
    "高値圏で大陰線が出ている",
    "前日の上昇分を大きく打ち消している",
    "利確売りが強まっている",
  ],

  boostConditions: [
    "出来高急増",
    "長い上ヒゲ後の大陰線",
    "重要ラインを下抜け",
    "地合いが弱い",
  ],

  weakConditions: [
    "翌足ですぐ反発",
    "出来高が少ない",
    "下ヒゲで戻している",
  ],

  beginnerText:
    "急に上がったあと、大きな陰線で売られた形です。利益確定や失望売りで下がりやすくなることがあります。",

  notification: {
    title: "🔴 強い下落警戒",
    message: "急騰後の強い売りを検知しました",
    example:
      "7011 三菱重工\n🔴 強い下落警戒\n勝率 77%\n「急騰後の強い売りを検知しました」",
  },
};