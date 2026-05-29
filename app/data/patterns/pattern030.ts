export const pattern030 = {
  id: "pattern030",
  name: "サポート割れ",
  direction: "sell",
  signal: "🔴 強い下落警戒",
  winRate: 78,
  score: 31,
  importance: "★★★★★",

  simpleMessage: "大きく下がる可能性があります",
  reason: "重要な下値ラインを割り込みました",

  conditions: [
    "何度も反発していた価格帯がある",
    "その価格帯を下抜ける",
    "陰線で強く割り込む",
    "売り圧力が急増している",
  ],

  boostConditions: [
    "出来高増加",
    "大陰線発生",
    "日経平均も弱い",
    "移動平均線も下抜け",
  ],

  weakConditions: [
    "すぐライン上に戻る",
    "下ヒゲで戻す",
    "出来高不足",
  ],

  beginnerText:
    "今まで下げ止まっていた重要なラインを割った形です。売りが増え、大きく下落することがあります。",

  notification: {
    title: "🔴 強い下落警戒",
    message: "重要ライン割れを検知しました",
    example:
      "9984 ソフトバンクG\n🔴 強い下落警戒\n勝率 78%\n「重要ライン割れを検知しました」",
  },
};