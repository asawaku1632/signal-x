export const pattern018 = {
  id: "pattern018",
  name: "高値更新ブレイク",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 76,
  score: 28,
  importance: "★★★★★",

  simpleMessage: "さらに上がる可能性があります",
  reason: "直近の高値を突破し、買いの勢いが強まっています",

  conditions: [
    "直近高値を上抜けている",
    "高値更新時に陽線が出ている",
    "上昇トレンドが続いている",
    "買いの勢いが強い",
  ],

  boostConditions: [
    "出来高が増えている",
    "上抜け時に大陽線",
    "移動平均線が上向き",
    "市場全体が強い",
  ],

  weakConditions: [
    "高値更新後すぐ戻される",
    "長い上ヒゲが出る",
    "出来高が少ない",
  ],

  beginnerText:
    "今まで超えられなかった高値を突破した形です。買いたい人が増え、さらに上昇することがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "高値更新を検知しました",
    example:
      "7203 トヨタ\n🟢 強い買い\n勝率 76%\n「高値更新を検知しました」",
  },
};