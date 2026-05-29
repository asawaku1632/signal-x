export const pattern011 = {
  id: "pattern011",
  name: "高値切り下げ下落",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 72,
  score: 26,
  importance: "★★★★★",

  simpleMessage: "売りが強くなっています",
  reason: "高値を更新できず、徐々に弱くなっています",

  conditions: [
    "高値が徐々に低くなっている",
    "反発しても前回高値を超えられない",
    "売り圧力が強まっている",
    "安値更新が始まる",
  ],

  boostConditions: [
    "出来高増加",
    "陰線連続",
    "移動平均線を下抜け",
    "日経平均も弱い",
  ],

  weakConditions: [
    "急反発して高値更新",
    "出来高が少ない",
    "長い下ヒゲ発生",
  ],

  beginnerText:
    "上がろうとしても前回より高く行けず、徐々に力が弱くなっている形です。下落トレンドに入ることがあります。",

  notification: {
    title: "🔴 下落警戒",
    message: "売り圧力が強まっています",
    example:
      "9984 ソフトバンクG\n🔴 下落警戒\n勝率 72%\n「売り圧力が強まっています」",
  },
};