export const pattern012 = {
  id: "pattern012",
  name: "急騰後失速",
  direction: "sell",
  signal: "🔴 下落警戒",
  winRate: 70,
  score: 25,
  importance: "★★★★☆",

  simpleMessage: "反落に注意です",
  reason: "急上昇後に買いの勢いが弱まっています",

  conditions: [
    "短時間で大きく上昇している",
    "上昇後に勢いが止まる",
    "高値圏で横ばいになる",
    "陰線が出始める",
  ],

  boostConditions: [
    "長い上ヒゲ",
    "出来高急増",
    "高値更新失敗",
    "地合い悪化",
  ],

  weakConditions: [
    "再び高値更新",
    "出来高減少",
    "押し目が浅い",
  ],

  beginnerText:
    "急激に上がったあと、買いの勢いが弱くなっている形です。利益確定売りで下落することがあります。",

  notification: {
    title: "🔴 下落警戒",
    message: "急騰後の失速を検知しました",
    example:
      "7011 三菱重工\n🔴 下落警戒\n勝率 70%\n「急騰後の失速を検知しました」",
  },
};