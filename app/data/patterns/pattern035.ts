export const pattern035 = {
  id: "pattern035",
  name: "ディセンディングトライアングル",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 76,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "下に抜ける可能性があります",
  reason: "下値の支えに何度も接近しながら、高値が切り下がっています",

  conditions: [
    "下値が同じ価格帯で支えられている",
    "高値が徐々に切り下がっている",
    "値幅が狭くなっている",
    "最後に下値支持線を下抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "下抜け時に大陰線",
    "直近安値を更新",
    "移動平均線が下向き",
  ],

  weakConditions: [
    "下抜け失敗",
    "高値切り下げが崩れる",
    "長い下ヒゲで戻す",
  ],

  beginnerText:
    "下のラインで何度も耐えているものの、反発する力が弱くなっている形です。最後に支えを割ると下落が強まることがあります。",

  notification: {
    title: "🔴 下落警戒",
    message: "下抜け前兆を検知しました",
    example:
      "7203 トヨタ\n🔴 下落警戒\n勝率 76%\n「下抜け前兆を検知しました」",
  },
};