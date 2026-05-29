export const pattern024 = {
  id: "pattern024",
  name: "長期線タッチ反発",
  direction: "buy",
  signal: "🟢 買い",
  winRate: 74,
  score: 26,
 importance: "★★★★☆",

  simpleMessage: "反発上昇の可能性があります",
  reason: "長期的に意識されるラインで買いが入っています",

  conditions: [
    "株価が長期移動平均線まで下落している",
    "長期線付近で下げ止まる",
    "下ヒゲや陽線で反発する",
    "再び上方向へ動き始める",
  ],

  boostConditions: [
    "出来高増加",
    "長い下ヒゲ",
    "過去にも同じ線で反発している",
    "日経平均が強い",
  ],

  weakConditions: [
    "長期線を大きく割る",
    "陰線連続",
    "出来高不足",
  ],

  beginnerText:
    "長期的に重要な平均線まで下がったあと、買いが入り反発し始める形です。押し目買いのポイントになることがあります。",

  notification: {
    title: "🟢 買い",
    message: "長期線で反発しています",
    example:
      "6758 ソニーG\n🟢 買い\n勝率 74%\n「長期線で反発しています」",
  },
};