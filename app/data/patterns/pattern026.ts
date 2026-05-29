export const pattern026 = {
  id: "pattern026",
  name: "出来高先行急騰",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 76,
  score: 29,
  importance: "★★★★★",

  simpleMessage: "急騰前兆の可能性があります",
  reason: "株価より先に出来高が増え、資金流入が始まっています",

  conditions: [
    "株価はまだ大きく動いていない",
    "出来高が先に増え始めている",
    "直近平均より出来高が明らかに多い",
    "その後に陽線が出始める",
  ],

  boostConditions: [
    "材料ニュースあり",
    "短期線を上抜け",
    "直近高値を突破",
    "買い板が厚くなっている",
  ],

  weakConditions: [
    "出来高だけ増えて株価が上がらない",
    "上ヒゲが長い",
    "翌足で陰線になる",
  ],

  beginnerText:
    "株価が大きく上がる前に、先に出来高が増えている形です。大きなお金が入り始めているサインになることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "資金流入の前兆を検知しました",
    example:
      "7011 三菱重工\n🟢 強い買い\n勝率 76%\n「資金流入の前兆を検知しました」",
  },
};