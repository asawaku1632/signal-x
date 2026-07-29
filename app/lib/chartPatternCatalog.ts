import type { PatternDirection } from "./chartPatternEngine";

export const CHART_PATTERN_CATEGORIES = [
  "反転パターン",
  "継続パターン",
  "ブレイクアウト",
  "移動平均線",
  "ローソク足",
  "サポート／レジスタンス",
  "レンジ／ボックス",
  "ボラティリティ",
] as const;

export type ChartPatternCategory = (typeof CHART_PATTERN_CATEGORIES)[number];
export type ChartPatternDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type ChartPatternCatalogItem = {
  id: string;
  name: string;
  engineNames: string[];
  direction: PatternDirection;
  category: ChartPatternCategory;
  difficulty: ChartPatternDifficulty;
  summary: string;
  formation: string[];
  aiChecks: string[];
  entryGuide: string[];
  takeProfitGuide: string[];
  stopLossGuide: string[];
  cautions: string[];
  diagramPoints: string;
};

type CatalogSource = Omit<
  ChartPatternCatalogItem,
  "entryGuide" | "takeProfitGuide" | "stopLossGuide"
>;

function tradingGuides(direction: PatternDirection) {
  if (direction === "BUY") {
    return {
      entryGuide: ["上抜けや反発を終値で確認し、出来高や上位足の流れも照合する", "確認前に形だけを見て先回りしない"],
      takeProfitGuide: ["次の抵抗帯や直近高値を段階的な確認候補にする", "上昇の勢いが弱まった場合は前提を見直す"],
      stopLossGuide: ["形の起点となる安値や支持線を明確に割った位置を基準に考える", "許容損失額から逆算し、無理な値幅にしない"],
    };
  }

  if (direction === "SELL") {
    return {
      entryGuide: ["下抜けや反落を終値で確認し、出来高や上位足の流れも照合する", "形だけで保有銘柄を即座に売却せず、支持帯との位置関係を確認する"],
      takeProfitGuide: ["次の支持帯や直近安値を段階的な確認候補にする", "下落の勢いが弱まった場合は前提を見直す"],
      stopLossGuide: ["形の起点となる高値や抵抗線を明確に上回った位置を基準に考える", "許容損失額から逆算し、無理な値幅にしない"],
    };
  }

  return {
    entryGuide: ["レンジや収縮のどちら側へ抜けるかを終値で確認する", "方向確定前は支持線・抵抗線と出来高の変化を観察する"],
    takeProfitGuide: ["確定した方向にある次の支持帯・抵抗帯を確認候補にする", "ブレイク後の勢いが続かない場合は前提を見直す"],
    stopLossGuide: ["ブレイクした境界の内側へ戻った場合を失敗の判断材料にする", "方向確定前に損失幅を曖昧にした取引をしない"],
  };
}

function definePattern(source: CatalogSource): ChartPatternCatalogItem {
  return { ...source, ...tradingGuides(source.direction) };
}

export const chartPatternCatalog: ChartPatternCatalogItem[] = [
  definePattern({
    id: "pattern002", name: "ダブルボトム反発", engineNames: ["ダブルボトム反発"], direction: "BUY", category: "反転パターン", difficulty: "BEGINNER",
    summary: "近い価格帯で二度下げ止まり、底固めからの反発を示す形です。",
    formation: ["近い水準に二つの安値ができる", "二つの安値の間にネックラインとなる高値がある"],
    aiChecks: ["二つの安値の価格差と間隔", "ネックラインへの回復・上抜け", "反発時の出来高"],
    cautions: ["二つ目の安値が維持できないと形が崩れる", "ネックライン未突破では反発が続くとは限らない"],
    diagramPoints: "4,18 20,45 36,22 52,45 70,20 92,8",
  }),
  definePattern({
    id: "pattern020", name: "ダブルトップ反落", engineNames: ["ダブルトップ反落"], direction: "SELL", category: "反転パターン", difficulty: "BEGINNER",
    summary: "近い価格帯で二度上昇を止められ、天井形成からの反落を示す形です。",
    formation: ["近い水準に二つの高値ができる", "二つの高値の間にネックラインとなる安値がある"],
    aiChecks: ["二つの高値の価格差と間隔", "ネックラインへの下落・下抜け", "反落時の出来高"],
    cautions: ["高値を更新すると形が崩れる", "ネックライン未割れでは下落方向が確定していない"],
    diagramPoints: "4,42 20,14 36,38 52,14 70,40 92,52",
  }),
  definePattern({
    id: "pattern021", name: "三尊天井", engineNames: ["三尊天井"], direction: "SELL", category: "反転パターン", difficulty: "INTERMEDIATE",
    summary: "中央の高値が左右より高い三つの山を作る、上昇から下落への反転候補です。",
    formation: ["左右の肩に相当する高値が近い", "中央の高値が左右より明確に高い", "谷を結ぶネックラインができる"],
    aiChecks: ["三つの高値の位置関係", "左右の肩の近さ", "ネックライン下抜けと出来高"],
    cautions: ["右肩形成中は形が未完成", "ネックラインを割らず再上昇する場合がある"],
    diagramPoints: "4,42 18,24 30,39 48,8 65,39 78,24 92,48",
  }),
  definePattern({
    id: "pattern022", name: "逆三尊", engineNames: ["逆三尊"], direction: "BUY", category: "反転パターン", difficulty: "INTERMEDIATE",
    summary: "中央の安値が左右より深い三つの谷を作る、下落から上昇への反転候補です。",
    formation: ["左右の肩に相当する安値が近い", "中央の安値が左右より明確に深い", "戻り高値を結ぶネックラインができる"],
    aiChecks: ["三つの安値の位置関係", "左右の肩の近さ", "ネックライン上抜けと出来高"],
    cautions: ["右肩形成中は形が未完成", "ネックラインを超えず再下落する場合がある"],
    diagramPoints: "4,18 18,36 30,20 48,52 65,20 78,36 92,10",
  }),
  definePattern({
    id: "pattern031", name: "上昇三角持ち合い", engineNames: ["上昇三角持ち合い"], direction: "BUY", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "上値抵抗が横ばいのまま安値が切り上がり、上方向への圧力が高まる形です。",
    formation: ["高値がほぼ同じ水準で止まる", "安値が段階的に切り上がる", "値幅が収縮する"],
    aiChecks: ["上値抵抗の傾き", "安値の切り上がり", "上限付近の終値と出来高"],
    cautions: ["上限を抜ける前は持ち合いが継続中", "だましの上抜けに注意する"],
    diagramPoints: "4,46 20,14 34,38 48,14 61,29 74,14 92,7",
  }),
  definePattern({
    id: "pattern032", name: "下降三角持ち合い", engineNames: ["下降三角持ち合い"], direction: "SELL", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "下値支持が横ばいのまま高値が切り下がり、下方向への圧力が高まる形です。",
    formation: ["安値がほぼ同じ水準で止まる", "高値が段階的に切り下がる", "値幅が収縮する"],
    aiChecks: ["下値支持の傾き", "高値の切り下がり", "下限付近の終値と出来高"],
    cautions: ["下限を割る前は持ち合いが継続中", "だましの下抜けに注意する"],
    diagramPoints: "4,8 20,44 34,17 48,44 61,27 74,44 92,52",
  }),
  definePattern({
    id: "pattern033", name: "対称三角持ち合い", engineNames: ["対称三角持ち合い"], direction: "NEUTRAL", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "高値切り下げと安値切り上げが同時に進み、抜けた方向を確認する形です。",
    formation: ["高値が切り下がる", "安値が切り上がる", "値幅が三角形状に収縮する"],
    aiChecks: ["上下ラインの収束", "終値が抜けた方向", "方向確定後の出来高"],
    cautions: ["Engineの方向はブレイクに応じBUY・SELL・NEUTRALへ変化する", "収縮中に方向を決めつけない"],
    diagramPoints: "4,8 18,46 32,16 46,39 61,23 75,32 92,27",
  }),
  definePattern({
    id: "pattern034", name: "上昇フラッグ", engineNames: ["上昇フラッグ"], direction: "BUY", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "急上昇後に緩やかな下向き調整を作り、上昇再開を確認する形です。",
    formation: ["急な上昇でポールを作る", "高値・安値が平行に緩く切り下がる", "調整幅が上昇幅に対して限定的"],
    aiChecks: ["上昇ポールの強さ", "調整ラインの平行性", "フラッグ上限の突破"],
    cautions: ["調整が深すぎる場合は継続形にならない", "上限突破前は調整が続く可能性がある"],
    diagramPoints: "4,50 32,8 42,22 55,14 67,28 78,20 92,4",
  }),
  definePattern({
    id: "pattern035", name: "下降フラッグ", engineNames: ["下降フラッグ"], direction: "SELL", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "急下落後に緩やかな上向き戻りを作り、下落再開を確認する形です。",
    formation: ["急な下落でポールを作る", "高値・安値が平行に緩く切り上がる", "戻り幅が下落幅に対して限定的"],
    aiChecks: ["下降ポールの強さ", "戻りラインの平行性", "フラッグ下限の下抜け"],
    cautions: ["戻りが大きすぎる場合は継続形にならない", "下限割れ前は戻りが続く可能性がある"],
    diagramPoints: "4,6 32,49 42,35 55,43 67,29 78,37 92,53",
  }),
  definePattern({
    id: "pattern039", name: "カップウィズハンドル", engineNames: ["カップウィズハンドル"], direction: "BUY", category: "継続パターン", difficulty: "ADVANCED",
    summary: "丸い底のカップと浅い調整のハンドルを経て、上値突破をうかがう形です。",
    formation: ["左右のリムが近い高さになる", "中央に丸みのある底を作る", "右側で浅いハンドルを作る"],
    aiChecks: ["カップの深さと左右リムの差", "ハンドルの深さと傾き", "リム上抜けと出来高"],
    cautions: ["V字型の急反発は丸いカップと異なる", "深すぎるハンドルは形の信頼性を下げる"],
    diagramPoints: "4,12 14,28 25,43 38,50 51,43 63,26 72,12 80,22 88,17 94,7",
  }),
  definePattern({
    id: "pattern040", name: "上昇ウェッジ", engineNames: ["上昇ウェッジ"], direction: "SELL", category: "反転パターン", difficulty: "ADVANCED",
    summary: "高値・安値がともに上がりながら値幅が縮み、下方向への崩れを警戒する形です。",
    formation: ["高値と安値がともに切り上がる", "安値側がより速く上がる", "値幅が収縮する"],
    aiChecks: ["上下ラインの傾きの差", "収縮率", "下限の終値割れ"],
    cautions: ["上昇中でも下落警戒の形になり得る", "下限を割るまでは上昇が続く場合がある"],
    diagramPoints: "4,46 18,25 31,39 45,20 59,31 74,16 88,22 94,49",
  }),
  definePattern({
    id: "pattern041", name: "下降ウェッジ", engineNames: ["下降ウェッジ"], direction: "BUY", category: "反転パターン", difficulty: "ADVANCED",
    summary: "高値・安値がともに下がりながら値幅が縮み、上方向への反発をうかがう形です。",
    formation: ["高値と安値がともに切り下がる", "高値側がより速く下がる", "値幅が収縮する"],
    aiChecks: ["上下ラインの傾きの差", "収縮率", "上限の終値突破"],
    cautions: ["下落中でも上昇候補の形になり得る", "上限を超えるまでは下落が続く場合がある"],
    diagramPoints: "4,8 18,29 31,15 45,34 59,23 74,38 88,32 94,5",
  }),
  definePattern({
    id: "pattern042", name: "ペナント（上昇／下降）", engineNames: ["上昇ペナント", "下降ペナント"], direction: "NEUTRAL", category: "継続パターン", difficulty: "ADVANCED",
    summary: "急な値動きの後に短い三角持ち合いを作り、元の方向への再開を確認する形です。",
    formation: ["急上昇または急下降のポールを作る", "その後に短期間の対称三角形を作る", "値幅がポールに対して小さい"],
    aiChecks: ["ポールの方向と大きさ", "持ち合いの収縮", "上限・下限突破と出来高"],
    cautions: ["Engineでは同一IDが上昇ペナントまたは下降ペナントとして検出される", "ポールが弱い場合は通常の持ち合いと区別しにくい"],
    diagramPoints: "4,48 32,8 43,19 53,35 63,22 73,31 84,25 94,7",
  }),
  definePattern({
    id: "pattern003", name: "レンジ上抜けブレイク", engineNames: ["レンジ上抜けブレイク"], direction: "BUY", category: "ブレイクアウト", difficulty: "BEGINNER",
    summary: "一定の値幅で推移した後、上限を終値で超えた状態です。",
    formation: ["直近の高値と安値でレンジを作る", "終値がレンジ上限を上回る"],
    aiChecks: ["直近レンジの広さ", "上限に対する終値", "上抜け時の出来高"],
    cautions: ["上抜け後すぐレンジ内へ戻るだましがある", "広すぎる値幅は通常の乱高下の場合がある"],
    diagramPoints: "4,38 18,18 31,39 44,17 58,37 70,18 79,14 92,4",
  }),
  definePattern({
    id: "pattern018", name: "高値更新ブレイク", engineNames: ["高値更新ブレイク"], direction: "BUY", category: "ブレイクアウト", difficulty: "BEGINNER",
    summary: "直近60本の高値を終値で更新し、上方向への動きが強まった状態です。",
    formation: ["比較対象となる直近高値がある", "最新終値がその高値を上回る"],
    aiChecks: ["60本の最高値", "更新幅", "更新時の出来高"],
    cautions: ["高値更新直後は値動きが大きくなりやすい", "終値で高値を維持できるか確認する"],
    diagramPoints: "4,45 18,30 31,38 45,19 58,29 70,14 80,16 93,4",
  }),
  definePattern({
    id: "pattern043", name: "出来高急増ブレイク", engineNames: ["出来高急増ブレイク"], direction: "BUY", category: "ブレイクアウト", difficulty: "INTERMEDIATE",
    summary: "出来高が急増する中で直近高値を終値で上抜けた状態です。",
    formation: ["出来高が直近平均より明確に増える", "終値が直近高値を超える"],
    aiChecks: ["出来高倍率", "直近抵抗の上抜け", "ローソク足の実体"],
    cautions: ["一時的な材料で出来高だけが増える場合がある", "上抜け水準を維持できるか確認する"],
    diagramPoints: "4,43 17,31 30,37 44,25 57,32 69,18 78,16 92,3",
  }),
  definePattern({
    id: "pattern044", name: "出来高急増下抜け", engineNames: ["出来高急増下抜け"], direction: "SELL", category: "ブレイクアウト", difficulty: "INTERMEDIATE",
    summary: "出来高が急増する中で直近安値を終値で下抜けた状態です。",
    formation: ["出来高が直近平均より明確に増える", "終値が直近安値を割る"],
    aiChecks: ["出来高倍率", "直近支持の下抜け", "ローソク足の実体"],
    cautions: ["一時的な材料で出来高だけが増える場合がある", "下抜け水準の上へ戻らないか確認する"],
    diagramPoints: "4,12 17,24 30,18 44,30 57,23 69,37 78,39 92,53",
  }),
  definePattern({
    id: "pattern014", name: "ゴールデンクロス初動", engineNames: ["ゴールデンクロス初動"], direction: "BUY", category: "移動平均線", difficulty: "BEGINNER",
    summary: "短い期間のEMA20が長い期間のEMA75を上抜けた局面です。",
    formation: ["EMA20がEMA75の下側から接近する", "EMA20がEMA75を上抜ける"],
    aiChecks: ["前足と最新足のEMA位置関係", "クロス後の価格推移"],
    cautions: ["横ばい相場ではクロスが頻発しやすい", "クロスだけでトレンド継続は保証されない"],
    diagramPoints: "4,43 20,39 36,34 50,27 64,18 79,9 94,5",
  }),
  definePattern({
    id: "pattern029", name: "デッドクロス", engineNames: ["デッドクロス"], direction: "SELL", category: "移動平均線", difficulty: "BEGINNER",
    summary: "短い期間のEMA20が長い期間のEMA75を下抜けた局面です。",
    formation: ["EMA20がEMA75の上側から接近する", "EMA20がEMA75を下抜ける"],
    aiChecks: ["前足と最新足のEMA位置関係", "クロス後の価格推移"],
    cautions: ["横ばい相場ではクロスが頻発しやすい", "クロスだけで下落継続は保証されない"],
    diagramPoints: "4,10 20,14 36,19 50,27 64,36 79,45 94,50",
  }),
  definePattern({
    id: "pattern046", name: "上昇パーフェクトオーダー", engineNames: ["上昇パーフェクトオーダー"], direction: "BUY", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "EMA5・EMA20・EMA75が上向きの順序で並ぶ上昇トレンドの形です。",
    formation: ["EMA5がEMA20より上", "EMA20がEMA75より上", "三本のEMAがすべて上向く"],
    aiChecks: ["三本のEMAの順序", "数本前と比較した各EMAの傾き"],
    cautions: ["成立時点ですでに上昇が進んでいる場合がある", "価格と短期EMAの乖離に注意する"],
    diagramPoints: "4,48 20,41 36,33 52,25 68,16 84,9 95,5",
  }),
  definePattern({
    id: "pattern047", name: "下降パーフェクトオーダー", engineNames: ["下降パーフェクトオーダー"], direction: "SELL", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "EMA5・EMA20・EMA75が下向きの順序で並ぶ下降トレンドの形です。",
    formation: ["EMA5がEMA20より下", "EMA20がEMA75より下", "三本のEMAがすべて下向く"],
    aiChecks: ["三本のEMAの順序", "数本前と比較した各EMAの傾き"],
    cautions: ["成立時点ですでに下落が進んでいる場合がある", "価格と短期EMAの乖離に注意する"],
    diagramPoints: "4,7 20,14 36,22 52,30 68,39 84,46 95,51",
  }),
  definePattern({
    id: "pattern006", name: "下ヒゲ反発", engineNames: ["下ヒゲ反発"], direction: "BUY", category: "ローソク足", difficulty: "BEGINNER",
    summary: "長い下ヒゲが安値からの買い戻しを示す、一本文の反発候補です。",
    formation: ["下ヒゲが実体の二倍以上になる", "下ヒゲが上ヒゲより明確に長い"],
    aiChecks: ["実体に対する下ヒゲ比率", "陽線かどうか", "出来高の増加"],
    cautions: ["一本の足だけでは反転を断定できない", "下降トレンド中は次の足の確認が重要"],
    diagramPoints: "8,18 25,31 42,20 57,34 70,12 78,43 87,26 94,14",
  }),
  definePattern({
    id: "pattern030", name: "サポート割れ", engineNames: ["サポート割れ"], direction: "SELL", category: "サポート／レジスタンス", difficulty: "BEGINNER",
    summary: "直近の支持帯を終値で下抜け、下方向への警戒が高まった状態です。",
    formation: ["直近安値が支持帯として意識される", "最新終値が支持帯を割る"],
    aiChecks: ["直近20本の安値", "支持帯に対する終値", "下落時の出来高"],
    cautions: ["一時的に割ってすぐ戻る場合がある", "次の支持帯までの距離も確認する"],
    diagramPoints: "4,15 17,34 30,19 44,36 57,22 69,38 80,39 93,53",
  }),
  definePattern({
    id: "pattern036", name: "ボックス相場", engineNames: ["ボックス相場"], direction: "NEUTRAL", category: "レンジ／ボックス", difficulty: "BEGINNER",
    summary: "水平な支持線と抵抗線の間で価格が往復し、方向が定まっていない状態です。",
    formation: ["水平に近い上限と下限がある", "上下の境界をそれぞれ複数回確認する", "大半の終値が範囲内に収まる"],
    aiChecks: ["上限・下限の傾き", "境界への接触回数", "範囲内に収まる終値の割合"],
    cautions: ["方向は上抜け・下抜けまで確定しない", "狭すぎる範囲はノイズの場合がある"],
    diagramPoints: "4,18 16,42 29,17 42,41 55,18 68,42 81,18 94,38",
  }),
  definePattern({
    id: "pattern037", name: "ボックス上抜け", engineNames: ["ボックス上抜け"], direction: "BUY", category: "レンジ／ボックス", difficulty: "BEGINNER",
    summary: "水平なボックス相場の上限を終値で突破した状態です。",
    formation: ["上限と下限を複数回確認したボックスがある", "最新終値が上限を超える"],
    aiChecks: ["ボックスの安定性", "上限の突破幅", "突破時の出来高"],
    cautions: ["上限内へ戻るだましに注意する", "突破直後の高値追いは値幅を確認する"],
    diagramPoints: "4,39 17,17 30,39 43,17 56,39 68,17 78,13 93,4",
  }),
  definePattern({
    id: "pattern038", name: "ボックス下抜け", engineNames: ["ボックス下抜け"], direction: "SELL", category: "レンジ／ボックス", difficulty: "BEGINNER",
    summary: "水平なボックス相場の下限を終値で割り込んだ状態です。",
    formation: ["上限と下限を複数回確認したボックスがある", "最新終値が下限を割る"],
    aiChecks: ["ボックスの安定性", "下限の割れ幅", "下抜け時の出来高"],
    cautions: ["下限内へ戻るだましに注意する", "下抜け直後は値動きが大きくなりやすい"],
    diagramPoints: "4,17 17,39 30,17 43,39 56,17 68,39 78,43 93,52",
  }),
  definePattern({
    id: "pattern045", name: "ボリンジャーバンドスクイーズ", engineNames: ["ボリンジャーバンドスクイーズ"], direction: "NEUTRAL", category: "ボラティリティ", difficulty: "ADVANCED",
    summary: "バンド幅が過去の低水準まで縮み、次の大きな値動きに備える状態です。",
    formation: ["20期間の価格変動が小さくなる", "ボリンジャーバンド幅が過去の低水準になる"],
    aiChecks: ["過去のバンド幅分布", "上側・下側バンドの突破", "突破時の出来高"],
    cautions: ["Engineの方向はバンド突破に応じBUY・SELL・NEUTRALへ変化する", "スクイーズだけでは動く方向は分からない"],
    diagramPoints: "4,12 18,18 32,22 46,25 60,27 74,25 88,16 95,5",
  }),
];

const chartPatternCatalogById = new Map(
  chartPatternCatalog.map((pattern) => [pattern.id, pattern]),
);

export function getChartPatternCatalogItem(id: string) {
  return chartPatternCatalogById.get(id);
}

export function hasChartPatternCatalogItem(id: string) {
  return chartPatternCatalogById.has(id);
}
