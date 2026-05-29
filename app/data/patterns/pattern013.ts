export const pattern013 = {
  id: "pattern013",
  name: "急騰後押し目反発",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 77,
  score: 29,
  importance: "★★★★★",

  simpleMessage: "再上昇の可能性があります",
  reason: "急騰後の調整が終わり、買いが戻っています",

  conditions: [
    "直前に強い上昇がある",
    "一度下落して調整している",
    "移動平均線付近で止まる",
    "再び陽線が出始める",
  ],

  boostConditions: [
    "出来高維持",
    "押し目が浅い",
    "高値を再び更新",
    "市場全体が強い",
  ],

  weakConditions: [
    "押し目が深すぎる",
    "出来高急減",
    "安値更新",
  ],

  beginnerText:
    "急騰したあと一度休憩し、再び上がり始める形です。強い銘柄でよく見られる押し目パターンです。",

  notification: {
    title: "🟢 強い買い",
    message: "押し目買いが入っています",
    example:
      "7011 三菱重工\n🟢 強い買い\n勝率 77%\n「押し目買いが入っています」",
  },
};