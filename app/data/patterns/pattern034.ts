export const pattern034 = {
  id: "pattern034",
  name: "アセンディングトライアングル",
  direction: "buy",
  signal: "🟢 強い買い",
  winRate: 77,
  score: 30,
  importance: "★★★★★",

  simpleMessage: "上に抜ける可能性があります",
  reason: "上値の壁に何度も挑戦しながら、下値が切り上がっています",

  conditions: [
    "上値が同じ価格帯で止められている",
    "安値が徐々に切り上がっている",
    "値幅が狭くなっている",
    "最後に上値抵抗線を上抜ける",
  ],

  boostConditions: [
    "出来高増加",
    "上抜け時に大陽線",
    "直近高値を更新",
    "移動平均線が上向き",
  ],

  weakConditions: [
    "上抜け失敗",
    "安値切り上げが崩れる",
    "出来高不足",
  ],

  beginnerText:
    "上の壁に何度も止められながらも、下値がだんだん上がっている形です。買いの力が強まり、上に抜けることがあります。",

  notification: {
    title: "🟢 強い買い",
    message: "上抜け前兆を検知しました",
    example:
      "8035 東京エレクトロン\n🟢 強い買い\n勝率 77%\n「上抜け前兆を検知しました」",
  },
};