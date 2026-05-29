export const pattern002 = {
  id: "pattern002",
  name: "ダブルボトム反発",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 74,
  score: 25,
  importance: "★★★★★",

  simpleMessage: "反発上昇の可能性があります",
  reason: "2回下げ止まり、買いが入り始めています",

  conditions: [
    "同じ価格帯で2回反発している",
    "Wのような形になっている",
    "2回目の下落で安値を大きく更新していない",
    "ネックラインを上抜ける",
  ],

  boostConditions: [
    "出来高が増えている",
    "2回目の安値で長い下ヒゲ",
    "移動平均線を上抜けている",
    "日経全体が強い",
  ],

  weakConditions: [
    "2回目で安値更新",
    "ネックライン突破失敗",
    "出来高が少ない",
  ],

  beginnerText:
    "2回下がったあとに下げ止まり、反発し始めた形です。売りが弱まり、上昇へ切り替わることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "反発上昇の形です",
    example:
      "7203 トヨタ\n🟢 強い買い\n勝率 74%\n「反発上昇の形です」",
  },
};