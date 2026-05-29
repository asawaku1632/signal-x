export const pattern003 = {
  id: "pattern003",
  name: "レンジ上抜けブレイク",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 76,
  score: 28,
  importance: "★★★★★",

  simpleMessage: "上に動き出す可能性があります",
  reason: "長く止められていた価格を突破しました",

  conditions: [
    "一定価格帯で横ばいが続いている",
    "何度も同じ高値で止められている",
    "最後に高値を突破する",
    "陽線で強く抜ける",
  ],

  boostConditions: [
    "出来高急増",
    "長い陽線",
    "日経平均も強い",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "上抜け後すぐ下がる",
    "出来高不足",
    "上ヒゲが長い",
  ],

  beginnerText:
    "ずっと超えられなかった価格を突破した形です。買いが一気に集まり、上昇が始まることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "価格の壁を突破しました",
    example:
      "9984 ソフトバンクG\n🟢 強い買い\n勝率 76%\n「価格の壁を突破しました」",
  },
};