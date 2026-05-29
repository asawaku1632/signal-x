export const pattern020 = {
  id: "pattern020",
  name: "ダブルトップ反落",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 73,
  score: 27,
  importance: "★★★★★",

  simpleMessage: "下がる可能性があります",
  reason: "2回上値を止められ、買いの勢いが弱まっています",

  conditions: [
    "同じ価格帯で2回上昇が止められている",
    "Mのような形になっている",
    "2回目の上昇で高値を大きく更新できない",
    "ネックラインを下抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "2回目の高値で長い上ヒゲ",
    "移動平均線を下抜けている",
    "日経全体が弱い",
  ],

  weakConditions: [
    "2回目で高値更新",
    "ネックライン下抜け失敗",
    "出来高が少ない",
  ],

  beginnerText:
    "2回上がろうとして失敗し、下に崩れ始めた形です。買いの力が弱まり、下落につながることがあります。",

  notification: {
    title: "🔴 下落警戒",
    message: "上値で2回止められました",
    example:
      "7203 トヨタ\n🔴 下落警戒\n勝率 73%\n「上値で2回止められました」",
  },
};