export const pattern010 = {
  id: "pattern010",
  name: "上ヒゲ失速",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 68,
  score: 23,
  importance: "★★★★☆",

  simpleMessage: "下がる可能性があります",
  reason: "上に伸びたあと、強く売り戻されています",

  conditions: [
    "一度大きく上昇している",
    "ローソク足に長い上ヒゲがある",
    "終値が高値から大きく下がっている",
    "上値で売りが強く入っている",
  ],

  boostConditions: [
    "出来高が増えている",
    "高値圏で発生している",
    "直前に急騰している",
    "翌足が陰線になっている",
  ],

  weakConditions: [
    "翌足で再び高値を更新する",
    "出来高が少ない",
    "地合いが非常に強い",
  ],

  beginnerText:
    "一度は大きく上がったものの、上の価格で強く売られて押し戻された形です。短期的な下落や利確売りにつながることがあります。",

  notification: {
    title: "🔴 下落警戒",
    message: "上値で強く売られています",
    example:
      "7203 トヨタ\n🔴 下落警戒\n勝率 68%\n「上値で強く売られています」",
  },
};