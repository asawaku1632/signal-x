export const pattern029 = {
  id: "pattern029",
  name: "デッドクロス",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 71,
  score: 25,
  importance: "★★★★☆",

  simpleMessage: "下落トレンド入りに注意です",
  reason: "短期線が長期線を下抜け、流れが弱くなっています",

  conditions: [
    "短期移動平均線が長期移動平均線を上から下に抜ける",
    "株価が移動平均線の下にある",
    "移動平均線が下向き始めている",
    "売りの勢いが強まっている",
  ],

  boostConditions: [
    "出来高増加",
    "陰線が続いている",
    "直近安値を更新",
    "地合いが弱い",
  ],

  weakConditions: [
    "クロス後すぐ上に戻る",
    "出来高が少ない",
    "長い下ヒゲが出る",
  ],

  beginnerText:
    "短期の勢いが長期の流れを下回り、下落トレンドに入り始めた形です。売りサインとしてよく使われます。",

  notification: {
    title: "🔴 下落警戒",
    message: "下落トレンド入りのサインです",
    example:
      "7203 トヨタ\n🔴 下落警戒\n勝率 71%\n「下落トレンド入りのサインです」",
  },
};