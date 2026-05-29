export const pattern017 = {
  id: "pattern017",
  name: "ペナント上抜け",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 77,
  score: 29,
  importance: "★★★★★",

  simpleMessage: "上昇再開の可能性があります",
  reason: "強い上昇後に値幅が収縮し、再び上に抜け始めています",

  conditions: [
    "直前に強い上昇がある",
    "その後に値幅がだんだん狭くなる",
    "小さな三角持ち合いを形成する",
    "最後に上方向へブレイクする",
  ],

  boostConditions: [
    "出来高増加",
    "上抜け時に大陽線",
    "高値更新",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "下方向へ抜ける",
    "出来高不足",
    "上抜け後すぐ戻される",
  ],

  beginnerText:
    "強く上がったあと、少し休憩して力をため、再び上に動き出す形です。上昇継続のサインになることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "上昇再開の形です",
    example:
      "7011 三菱重工\n🟢 強い買い\n勝率 77%\n「上昇再開の形です」",
  },
};