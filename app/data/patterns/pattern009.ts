export const pattern009 = {
  id: "pattern009",
  name: "下降チャネルブレイク",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 69,
  score: 24,
  importance: "★★★★☆",

  simpleMessage: "トレンド転換の可能性があります",
  reason: "下落の流れを上に抜け始めています",

  conditions: [
    "高値が切り下がっている",
    "安値も切り下がっている",
    "下降チャネル内で推移している",
    "最後にチャネル上限を上抜ける",
  ],

  boostConditions: [
    "出来高が増えている",
    "上抜け時に陽線",
    "直近高値も超えている",
    "移動平均線を上抜けている",
  ],

  weakConditions: [
    "上抜け後すぐチャネル内に戻る",
    "出来高不足",
    "上ヒゲ発生",
  ],

  beginnerText:
    "下がり続けていた流れを上方向へ抜け始めた形です。下落終了から反転上昇につながることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "下落トレンド終了の可能性",
    example:
      "6758 ソニーG\n🟢 強い買い\n勝率 69%\n「下落トレンド終了の可能性」",
  },
};