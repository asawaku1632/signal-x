export const pattern014 = {
  id: "pattern014",
  name: "ゴールデンクロス初動",
  direction: "buy",
  signal: "🟢 買い",
  winRate: 72,
  score: 24,
  importance: "★★★★☆",

  simpleMessage: "上昇トレンド入りの可能性があります",
  reason: "短期線が長期線を上抜け、流れが上向きになっています",

  conditions: [
    "短期移動平均線が長期移動平均線を下から上に抜ける",
    "株価が移動平均線の上にある",
    "移動平均線が上向き始めている",
    "上昇の初動になっている",
  ],

  boostConditions: [
    "出来高が増えている",
    "陽線が続いている",
    "直近高値を更新している",
    "地合いが強い",
  ],

  weakConditions: [
    "クロス後すぐ下に戻る",
    "出来高が少ない",
    "株価が長期線を割る",
  ],

  beginnerText:
    "短期の勢いが長期の流れを上回り、上昇トレンドに入り始めた形です。買いサインとしてよく使われます。",

  notification: {
    title: "🟢 買い",
    message: "上昇トレンド入りのサインです",
    example:
      "7203 トヨタ\n🟢 買い\n勝率 72%\n「上昇トレンド入りのサインです」",
  },
};