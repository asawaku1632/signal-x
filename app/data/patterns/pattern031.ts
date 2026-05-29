export const pattern031 = {
  id: "pattern031",
  name: "大陰線崩壊",
  direction: "sell",
  signal: "🔴 強い下落警戒",
  winRate: 79,
  score: 32,
  importance: "★★★★★",

  simpleMessage: "急落に注意です",
  reason: "強い売りが入り、一気に崩れ始めています",

  conditions: [
    "通常より大きな陰線が出ている",
    "重要ラインを下抜けている",
    "終値が安値付近",
    "売り圧力が非常に強い",
  ],

  boostConditions: [
    "出来高急増",
    "窓を開けて下落",
    "移動平均線を一気に下抜け",
    "市場全体も弱い",
  ],

  weakConditions: [
    "長い下ヒゲで戻す",
    "翌日すぐ反発",
    "出来高不足",
  ],

  beginnerText:
    "大きな陰線で一気に下落した形です。投げ売りや損切りが増え、さらに下落することがあります。",

  notification: {
    title: "🔴 強い下落警戒",
    message: "大きな崩れを検知しました",
    example:
      "7011 三菱重工\n🔴 強い下落警戒\n勝率 79%\n「大きな崩れを検知しました」",
  },
};