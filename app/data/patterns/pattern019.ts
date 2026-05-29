export const pattern019 = {
  id: "pattern019",
  name: "ボックス上抜け",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 75,
  score: 27,
  importance: "★★★★★",

  simpleMessage: "上昇開始の可能性があります",
  reason: "横ばいの上限を突破し、買いが優勢になっています",

  conditions: [
    "一定の価格帯で上下を繰り返している",
    "上限と下限がはっきりしている",
    "何度も上限で止められている",
    "最後にボックス上限を上抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "上抜け時に大陽線",
    "上抜け後に高値を維持",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "上抜け後すぐボックス内に戻る",
    "出来高不足",
    "長い上ヒゲ",
  ],

  beginnerText:
    "しばらく同じ範囲で動いていた株価が、上の壁を突破した形です。新しい上昇の始まりになることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "ボックス上抜けを検知しました",
    example:
      "6758 ソニーG\n🟢 強い買い\n勝率 75%\n「ボックス上抜けを検知しました」",
  },
};
