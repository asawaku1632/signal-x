export const pattern004 = {
  id: "pattern004",
  name: "200EMA反発",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 73,
  score: 24,
  importance: "★★★★☆",

  simpleMessage: "反発上昇の可能性があります",
  reason: "長期移動平均線で反発しています",

  conditions: [
    "株価が200EMA付近まで下落",
    "200EMAに接触",
    "下ヒゲや陽線で反発",
    "再び上方向へ動き始める",
  ],

  boostConditions: [
    "出来高増加",
    "長い下ヒゲ",
    "日経平均が強い",
    "過去にも同じEMAで反発している",
  ],

  weakConditions: [
    "200EMAを大きく割る",
    "陰線連続",
    "出来高不足",
  ],

  beginnerText:
    "長期的に意識されやすい平均線で株価が止まり、反発し始めた形です。押し目買いが入ることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "長期線で反発しています",
    example:
      "7203 トヨタ\n🟢 強い買い\n勝率 73%\n「長期線で反発しています」",
  },
};