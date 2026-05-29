export const pattern008 = {
  id: "pattern008",
  name: "レンジブレイク",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 76,
  score: 28,
  importance: "★★★★★",

  simpleMessage: "上に抜ける可能性があります",
  reason: "横ばいの上限を突破し始めています",

  conditions: [
    "一定の価格帯で横ばいが続いている",
    "上限と下限がはっきりしている",
    "上限付近で何度も止められている",
    "最後にレンジ上限を上抜ける",
  ],

  boostConditions: [
    "出来高が増えている",
    "上抜け時に大陽線",
    "移動平均線が上向き",
    "地合いが強い",
  ],

  weakConditions: [
    "上抜け後すぐレンジ内に戻る",
    "出来高が少ない",
    "長い上ヒゲが出る",
  ],

  beginnerText:
    "しばらく横ばいだった株価が、上の壁を突破した形です。買いが集まり、上昇が始まることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "上の壁を突破しました",
    example:
      "7203 トヨタ\n🟢 強い買い\n勝率 76%\n「上の壁を突破しました」",
  },
};