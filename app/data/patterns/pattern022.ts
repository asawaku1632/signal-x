export const pattern022 = {
  id: "pattern022",
  name: "逆三尊",
  direction: "buy",
  signal: "🟢 超強い買い",
  winRate: 80,
  score: 34,
  importance: "★★★★★",

  simpleMessage: "大きな反転上昇の可能性があります",
  reason: "下落トレンド終了後、強い買いが入り始めています",

  conditions: [
    "左肩・頭・右肩のような3つの谷がある",
    "中央の谷が一番深い",
    "右肩が頭より浅い",
    "ネックラインを上抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "ネックライン突破時に大陽線",
    "移動平均線上抜け",
    "日経平均も強い",
  ],

  weakConditions: [
    "ネックライン突破失敗",
    "右肩を割り込む",
    "出来高不足",
  ],

  beginnerText:
    "下落が続いたあと、3回底を作ってから上に抜ける形です。大きな反転上昇のサインになることがあります。",

  notification: {
    title: "🟢 超強い買い",
    message: "反転上昇パターンを検知しました",
    example:
      "7011 三菱重工\n🟢 超強い買い\n勝率 80%\n「反転上昇パターンを検知しました」",
  },
};