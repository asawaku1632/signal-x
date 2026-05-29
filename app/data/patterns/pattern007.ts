export const pattern007 = {
  id: "pattern007",
  name: "カップウィズハンドル",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 78,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "上昇再開の可能性があります",
  reason: "大きな底固め後に、最後の調整を抜け始めています",

  conditions: [
    "大きな丸い底のような形を作っている",
    "一度上昇したあと小さく調整している",
    "調整部分がハンドルのような形になっている",
    "ハンドル上限を上抜ける",
  ],

  boostConditions: [
    "出来高が増えている",
    "ハンドル部分の下落が浅い",
    "上抜け時に大陽線",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "ハンドル部分で大きく崩れる",
    "上抜け後すぐ戻される",
    "出来高が少ない",
  ],

  beginnerText:
    "長い時間をかけて底を作り、その後少し休んでから再び上に抜ける形です。上昇トレンドの再開サインになることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "上昇再開の形です",
    example:
      "8035 東京エレクトロン\n🟢 強い買い\n勝率 78%\n「上昇再開の形です」",
  },
};