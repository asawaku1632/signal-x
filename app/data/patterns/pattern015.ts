export const pattern015 = {
  id: "pattern015",
  name: "三角持ち合い上抜け",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 75,
  score: 27,
  importance: "★★★★★",

  simpleMessage: "大きく動き出す可能性があります",
  reason: "エネルギーを溜めたあと上方向へ抜け始めています",

  conditions: [
    "高値が徐々に低くなっている",
    "安値が徐々に高くなっている",
    "値幅が収縮している",
    "最後に上方向へブレイクする",
  ],

  boostConditions: [
    "出来高増加",
    "ブレイク時に大陽線",
    "移動平均線が上向き",
    "市場全体が強い",
  ],

  weakConditions: [
    "上抜け後すぐ戻される",
    "出来高不足",
    "長い上ヒゲ発生",
  ],

  beginnerText:
    "株価の動きがだんだん狭くなったあと、一気に上へ動き始める形です。強い上昇の初動になることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "エネルギー解放を検知しました",
    example:
      "8035 東京エレクトロン\n🟢 強い買い\n勝率 75%\n「エネルギー解放を検知しました」",
  },
};