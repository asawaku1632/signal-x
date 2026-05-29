export const pattern021 = {
  id: "pattern021",
  name: "三尊天井",
  direction: "sell",
  signal: "🔴 強い下落警戒",
  winRate: 76,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "大きく下がる可能性があります",
  reason: "高値圏で上昇に失敗し、下に崩れ始めています",

  conditions: [
    "左肩・頭・右肩のような3つの山がある",
    "中央の山が一番高い",
    "右肩が頭より低い",
    "ネックラインを下抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "右肩で上ヒゲが出ている",
    "ネックライン下抜け時に大陰線",
    "移動平均線を下抜けている",
  ],

  weakConditions: [
    "右肩後に高値を更新する",
    "ネックラインを割らない",
    "出来高が少ない",
  ],

  beginnerText:
    "高値圏で3回上がろうとして失敗し、最後に下へ崩れる形です。上昇トレンド終了のサインになることがあります。",

  notification: {
    title: "🔴 強い下落警戒",
    message: "上昇トレンド終了の可能性",
    example:
      "9984 ソフトバンクG\n🔴 強い下落警戒\n勝率 76%\n「上昇トレンド終了の可能性」",
  },
};