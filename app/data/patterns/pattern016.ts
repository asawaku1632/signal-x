export const pattern016 = {
  id: "pattern016",
  name: "フラッグブレイク",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 78,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "上昇再開の可能性があります",
  reason: "一時的な調整終了後、再び上昇し始めています",

  conditions: [
    "強い上昇が発生している",
    "その後小さな下降チャネルを形成",
    "調整幅が比較的小さい",
    "チャネル上限を上抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "上抜け時に大陽線",
    "高値更新",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "チャネル下抜け",
    "出来高不足",
    "上抜け失敗",
  ],

  beginnerText:
    "強く上がったあと、一度休憩してから再び上昇する形です。上昇トレンド継続のサインになることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "上昇トレンド継続を検知しました",
    example:
      "8035 東京エレクトロン\n🟢 強い買い\n勝率 78%\n「上昇トレンド継続を検知しました」",
  },
};