export const pattern006 = {
  id: "pattern006",
  name: "下ヒゲ反発",
  direction: "buy",
  signal: "🟢 買い",
  winRate: 70,
  score: 21,
  importance: "★★★★☆",

  simpleMessage: "反発する可能性があります",
  reason: "一度売られましたが、買い戻されています",

  conditions: [
    "一度大きく下落している",
    "ローソク足に長い下ヒゲがある",
    "終値が安値から大きく戻している",
    "下値で買いが入っている",
  ],

  boostConditions: [
    "出来高が増えている",
    "支持線付近で下ヒゲが出ている",
    "200EMA付近で反発している",
    "翌足が陽線になっている",
  ],

  weakConditions: [
    "翌足で再び下落",
    "下ヒゲ後も出来高が少ない",
    "支持線を割り込む",
  ],

  beginnerText:
    "一度大きく売られたあと、下の価格で買いが入り、押し戻された形です。反発のきっかけになることがあります。",

  notification: {
    title: "🟢 買い",
    message: "下値で買いが入りました",
    example:
      "6758 ソニーG\n🟢 買い\n勝率 70%\n「下値で買いが入りました」",
  },
};