export const pattern025 = {
  id: "pattern025",
  name: "初動陽線",
  direction: "buy",
  signal: "🟢 買い",
  winRate: 71,
  score: 23,
  importance: "★★★★☆",

  simpleMessage: "上昇初動の可能性があります",
  reason: "それまで弱かった流れから、買いが入り始めています",

  conditions: [
    "下落または横ばいが続いている",
    "突然強めの陽線が出る",
    "直近の陰線を打ち消している",
    "株価が短期線を上抜け始める",
  ],

  boostConditions: [
    "出来高増加",
    "下ヒゲを伴う陽線",
    "直近高値を上抜ける",
    "地合いが強い",
  ],

  weakConditions: [
    "翌足で陰線になる",
    "出来高不足",
    "上ヒゲが長い",
  ],

  beginnerText:
    "それまで動きが弱かった株に、買いが入り始めた形です。上昇の最初のサインになることがあります。",

  notification: {
    title: "🟢 買い",
    message: "上昇初動を検知しました",
    example:
      "7203 トヨタ\n🟢 買い\n勝率 71%\n「上昇初動を検知しました」",
  },
};