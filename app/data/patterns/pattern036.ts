export const pattern036 = {
  id: "pattern036",
  name: "押し目買い反発",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 81,
  score: 35,
  importance: "★★★★★",

  simpleMessage: "押し目から反発しています",
  reason: "上昇中の調整後に買いが入り始めています",

  conditions: [
    "上昇トレンド中",
    "一時的に下落している",
    "移動平均線付近で反発",
    "陽線が出始めている",
  ],

  boostConditions: [
    "出来高増加",
    "下ヒゲ陽線",
    "高値切り上げ",
    "地合いが強い",
  ],

  weakConditions: [
    "反発が弱い",
    "陰線が続く",
    "移動平均線を割る",
  ],

  beginnerText:
    "上昇中に一時的に下がったあと、再び買われ始めた形です。トレンド継続としてよく使われます。",

  notification: {
    title: "🟢 強い買い",
    message: "押し目反発を検知しました",
    example:
      "7203 トヨタ\n🟢 強い買い\n勝率 81%\n「押し目反発を検知しました」",
  },
};