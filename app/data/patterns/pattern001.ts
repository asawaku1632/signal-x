export const pattern001 = {
  id: "pattern001",
  name: "下降ウェッジ上抜け",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 71,
  score: 22,
  importance: "★★★★☆",

  simpleMessage: "上がる可能性が高まっています",
  reason: "売り圧力が弱まり、上に抜け始めています",

  conditions: [
    "高値が切り下がっている",
    "安値も切り下がっている",
    "値幅がだんだん狭くなっている",
    "最後に上方向へ抜ける",
  ],

  boostConditions: [
    "出来高が増えている",
    "下値支持線付近で反発している",
    "長い下ヒゲが出ている",
    "移動平均線を上抜けている",
  ],

  weakConditions: [
    "上抜け後にすぐ戻される",
    "出来高が少ない",
    "安値をさらに更新する",
  ],

  beginnerText:
    "下がり続けていた株が、だんだん下げ止まり、上に抜け始めた形です。反発上昇の初動になることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "過去によく上がった形です",
    example: "7203 トヨタ\n🟢 強い買い\n勝率 71%\n「過去によく上がった形です」",
  },
};