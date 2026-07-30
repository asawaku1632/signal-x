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
  definePattern({
    id: "pattern010", name: "上ヒゲ失速", engineNames: ["上ヒゲ失速"], direction: "SELL", category: "ローソク足", difficulty: "BEGINNER",
    summary: "上昇後の高値圏で長い上ヒゲを作り、上値から強く売り戻された状態です。",
    formation: ["直前まで上昇している", "高値圏で実体の二倍以上の上ヒゲを作る", "終値が高値から大きく押し戻される"],
    aiChecks: ["直前の上昇率", "実体に対する上ヒゲ比率", "高値から終値までの押し戻し", "出来高"],
    cautions: ["強い上昇相場では次の足で高値を更新する場合がある", "一本の足だけで中期的な反転を断定しない"],
    diagramPoints: "4,45 18,36 32,27 47,17 61,8 70,35 82,30 94,42",
  }),
  definePattern({
    id: "pattern011", name: "高値切り下げ下落", engineNames: ["高値切り下げ下落"], direction: "SELL", category: "反転パターン", difficulty: "BEGINNER",
    summary: "戻り高値が徐々に低くなり、直近安値の更新によって下落圧力が明確になった状態です。",
    formation: ["複数期間にわたり高値が切り下がる", "反発しても以前の高値に届かない", "終値が直近安値を下回る"],
    aiChecks: ["高値回帰線の傾き", "前半と後半の高値差", "直近支持の下抜け", "出来高"],
    cautions: ["一時的な調整だけで高値切り下げに見える場合がある", "長い下ヒゲで支持を回復した場合は前提を見直す"],
    diagramPoints: "4,8 17,25 29,16 42,32 55,24 68,40 80,34 94,52",
  }),
  definePattern({
    id: "pattern012", name: "急騰後失速", engineNames: ["急騰後失速"], direction: "SELL", category: "反転パターン", difficulty: "INTERMEDIATE",
    summary: "短期間に大きく上昇した後、高値を維持できず陰線で反落した状態です。",
    formation: ["短期間に明確な急騰がある", "急騰後に高値更新が止まる", "高値から押し戻され陰線になる"],
    aiChecks: ["急騰率", "ピークを付けた位置", "ピークからの下落率", "失速時の出来高"],
    cautions: ["小さな利確調整後に上昇を再開する場合がある", "急騰幅が小さい場合は通常の値動きと区別しにくい"],
    diagramPoints: "4,48 18,37 31,24 45,9 58,5 70,20 82,18 94,36",
  }),
  definePattern({
    id: "pattern025", name: "初動陽線", engineNames: ["初動陽線"], direction: "BUY", category: "ローソク足", difficulty: "BEGINNER",
    summary: "下落または横ばいの後に大きな陽線が現れ、直近高値を超えた上昇初動候補です。",
    formation: ["直前まで下落または横ばいで推移する", "直近平均より大きな陽線を作る", "終値が直近高値を上回る"],
    aiChecks: ["直前の値動き", "平均実体に対する陽線実体", "直近高値の突破", "出来高"],
    cautions: ["翌足で上抜けを維持できない場合がある", "上ヒゲが長い場合は買いの継続性を確認する"],
    diagramPoints: "4,38 17,41 30,36 43,42 56,37 68,40 79,25 94,8",
  }),
  definePattern({
    id: "pattern026", name: "出来高先行急騰", engineNames: ["出来高先行急騰"], direction: "BUY", category: "ブレイクアウト", difficulty: "INTERMEDIATE",
    summary: "価格が大きく動く前に出来高が増え、その次の足で上昇が始まった状態です。",
    formation: ["値幅の小さい推移が続く", "価格上昇に先行して出来高が急増する", "次の足が陽線となり上昇する"],
    aiChecks: ["先行足の出来高倍率", "出来高増加時の価格変動", "次足の上昇率", "出来高の持続"],
    cautions: ["出来高だけ増えて価格が動かない場合は採用しない", "材料による一時的な商い増加に注意する"],
    diagramPoints: "4,42 18,40 32,43 46,39 60,41 72,36 82,22 94,7",
  }),
  definePattern({
    id: "pattern009", name: "下降チャネルブレイク", engineNames: ["下降チャネルブレイク"], direction: "BUY", category: "反転パターン", difficulty: "INTERMEDIATE",
    summary: "平行に下降するチャネルの上限を終値で明確に突破し、下落トレンドからの転換を示す形です。",
    formation: ["高値線と安値線が概ね平行に下降する", "終値の大半がチャネル内に収まる", "最新終値がチャネル上限を明確に超える"],
    aiChecks: ["上下回帰線の傾きと平行性", "チャネル幅が収束していないこと", "上限に対する終値の突破幅", "出来高"],
    cautions: ["上ヒゲだけの突破は確定に含めない", "値幅が収束する場合は下降ウェッジとして評価する"],
    diagramPoints: "4,8 18,18 31,15 45,29 59,25 73,39 84,32 94,7",
  }),
  definePattern({
    id: "pattern001", name: "下降ウェッジ上抜け", engineNames: ["下降ウェッジ上抜け"], direction: "BUY", category: "反転パターン", difficulty: "ADVANCED",
    summary: "高値側が安値側より速く低下する下降ウェッジが収束し、上限を終値で突破した確定形です。",
    formation: ["高値と安値がともに切り下がる", "高値線の低下が安値線より速く値幅が収束する", "終値がウェッジ上限を明確に超える"],
    aiChecks: ["上下回帰線の傾き差", "値幅の収縮率", "ウェッジ内の終値比率", "終値突破幅と出来高"],
    cautions: ["形成中の下降ウェッジとは分けて扱う", "終値が上限内に戻った場合はブレイク失敗となる"],
    diagramPoints: "4,8 18,20 32,17 46,31 60,27 74,39 85,34 94,5",
  }),
  definePattern({
    id: "pattern013", name: "急騰後押し目反発", engineNames: ["急騰後押し目反発"], direction: "BUY", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "明確な急騰、適度な押し目、上値線を超える再反発が順番に成立した上昇継続形です。",
    formation: ["先に7%以上の急騰がある", "急騰幅の18〜50%を調整する", "終値が押し目の上値線を超えて再反発する"],
    aiChecks: ["急騰率と傾き", "押し目の深さと期間", "再反発足の実体", "出来高"],
    cautions: ["急騰を伴わない通常の反発は対象外", "押しが深すぎる場合は上昇継続の前提が崩れる"],
    diagramPoints: "4,48 18,32 32,13 45,6 58,20 70,29 82,20 94,5",
  }),
  definePattern({
    id: "pattern016", name: "フラッグブレイク", engineNames: ["フラッグブレイク"], direction: "BUY", category: "継続パターン", difficulty: "INTERMEDIATE",
    summary: "上昇ポール後の平行な下降フラッグを、終値で明確に上抜けた確定形です。",
    formation: ["6%以上の上昇ポールを形成する", "高値・安値が平行に緩く切り下がる", "終値がフラッグ上辺を明確に超える"],
    aiChecks: ["ポールの上昇率と傾き", "上下線の平行性", "調整幅", "終値突破幅と出来高"],
    cautions: ["フラッグ形成中とは分けて扱う", "上ヒゲだけ上辺を超えた場合は確定しない"],
    diagramPoints: "4,49 30,7 42,20 54,14 66,27 78,21 87,23 95,4",
  }),
  definePattern({
    id: "pattern017", name: "ペナント上抜け", engineNames: ["ペナント上抜け"], direction: "BUY", category: "継続パターン", difficulty: "ADVANCED",
    summary: "急上昇後の短い収束形状を、終値で上方向へ明確に突破した上昇ペナント確定形です。",
    formation: ["6%以上の急上昇ポールを形成する", "高値切り下げ・安値切り上げで値幅が収束する", "終値がペナント上辺を明確に超える"],
    aiChecks: ["ポールの上昇率", "上下回帰線の収束", "ペナントの大きさ", "終値突破幅と出来高"],
    cautions: ["形成中のペナントとは分けて扱う", "終値が収束範囲内の場合は確定しない"],
    diagramPoints: "4,49 30,7 43,19 54,34 65,23 76,31 86,25 95,5",
  }),
  definePattern({
    id: "pattern004", name: "ボリンジャーバンドスクイーズ", engineNames: ["ボリンジャーバンドスクイーズ"], direction: "NEUTRAL", category: "ボラティリティ", difficulty: "INTERMEDIATE",
    summary: "ボリンジャーバンド幅が過去の低水準まで継続的に縮小し、次の方向確定を待つ形成中パターンです。",
    formation: ["20期間の値動きが縮小する", "バンド幅が過去50期間の下位25%に入る", "終値がバンド内に留まる"],
    aiChecks: ["現在のバンド幅", "10期間前からの収縮率", "過去幅分布での位置", "終値と上下バンドの関係"],
    cautions: ["スクイーズだけでは方向を判断できない", "極端に値動きがない銘柄は除外する"],
    diagramPoints: "4,12 18,18 32,23 46,26 60,28 74,27 88,23 95,20",
  }),
  definePattern({
    id: "pattern005", name: "ボリンジャーバンドエクスパンション", engineNames: ["ボリンジャーバンドエクスパンション"], direction: "NEUTRAL", category: "ボラティリティ", difficulty: "ADVANCED",
    summary: "低水準だったバンド幅が出来高を伴って急拡大し、終値が直前バンドを突破した確定シグナルです。",
    formation: ["直前までバンド幅が低水準にある", "最新足でバンド幅が20%以上拡大する", "終値が直前の上側または下側バンドを明確に突破する"],
    aiChecks: ["直前のスクイーズ状態", "バンド幅の拡大率", "ローソク足実体", "終値突破幅と出来高"],
    cautions: ["Engine方向は上方拡大でBUY、下方拡大でSELLになる", "出来高を伴わない弱い拡大は対象外"],
    diagramPoints: "4,27 18,27 32,26 46,27 60,25 73,18 84,10 95,4",
  }),
  definePattern({
    id: "pattern007", name: "パーフェクトオーダー", engineNames: ["パーフェクトオーダー"], direction: "BUY", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "EMA5・EMA20・EMA75が上昇順序を複数足維持し、各線が上向きに広がった確定トレンドです。",
    formation: ["EMA5 > EMA20 > EMA75を3本連続で維持する", "三本のEMAがすべて上向く", "EMA同士に一定の間隔がある"],
    aiChecks: ["三本のEMA順序の継続", "各EMAの傾き", "EMA間隔"],
    cautions: ["成立時点で価格上昇が進んでいる場合がある", "EMA間隔が急拡大した局面では高値追いに注意する"],
    diagramPoints: "4,49 20,42 36,34 52,25 68,16 84,8 95,4",
  }),
  definePattern({
    id: "pattern008", name: "パーフェクトオーダー崩れ", engineNames: ["パーフェクトオーダー崩れ"], direction: "SELL", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "上昇配列だった短期EMAが中期EMAを継続的に下回り、価格も支持を割ったトレンド弱化シグナルです。",
    formation: ["直前までEMA5がEMA20より上にある", "EMA5がEMA20を2本連続で下回る", "終値がEMA20と直近安値を下回る"],
    aiChecks: ["クロス前のEMA順序", "クロスの継続本数", "終値とEMA20の位置", "直近安値と出来高"],
    cautions: ["一時的なクロスだけでは確定しない", "長期EMAの上昇が強い場合は短期調整に留まる可能性がある"],
    diagramPoints: "4,45 20,36 36,26 52,17 65,15 77,28 88,39 95,50",
  }),
  definePattern({
    id: "pattern015", name: "トレンド転換初動", engineNames: ["トレンド転換初動"], direction: "BUY", category: "移動平均線", difficulty: "ADVANCED",
    summary: "下降EMA配列から短期線が中期線を継続的に上抜き、価格も直近高値を突破した転換初動です。",
    formation: ["先にEMA5 < EMA20 < EMA75の下降配列がある", "EMA5がEMA20を2本連続で上回る", "終値が直近10本高値を明確に超える"],
    aiChecks: ["転換前の下降配列", "短期・中期EMAクロスの持続", "直近高値の突破", "出来高"],
    cautions: ["下降配列を伴わない通常の押し目反発は対象外", "一足だけのクロスや終値未突破は確定しない"],
    diagramPoints: "4,9 18,18 32,28 46,39 59,45 70,34 82,20 95,5",
  }),
  definePattern({
    id: "pattern019", name: "ボックス上抜け", engineNames: ["ボックス上抜け"], direction: "BUY", category: "レンジ／ボックス", difficulty: "INTERMEDIATE",
    summary: "20期間の明確なボックス相場を、出来高を伴う終値で上抜けた確定パターンです。",
    formation: ["水平な上限と下限を複数回確認する", "終値の大半がボックス内に収まる", "終値が上限を明確に突破する"],
    aiChecks: ["上下回帰線の水平性", "境界への接触回数", "範囲内終値率", "突破幅と出来高"],
    cautions: ["上ヒゲだけの突破は確定しない", "上限内へ戻った場合はブレイク失敗となる"],
    diagramPoints: "4,39 17,17 30,39 43,17 56,39 68,17 79,13 94,4",
  }),
  definePattern({
    id: "pattern023", name: "EMA収束反発", engineNames: ["EMA収束反発"], direction: "BUY", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "EMA5・EMA20・EMA75が近接した後、終値が三本と直近高値を上回った反発確定形です。",
    formation: ["三本のEMAが1.2%以内に収束する", "短期EMAが上向く", "終値が三本のEMAと直近高値を超える"],
    aiChecks: ["EMA最大幅", "EMA5の上昇率", "終値と各EMAの位置", "直近高値突破と出来高"],
    cautions: ["収束だけでは方向を判断しない", "一足だけの上振れではなく終値突破を確認する"],
    diagramPoints: "4,38 19,34 34,31 49,29 64,28 76,25 86,16 95,5",
  }),
  definePattern({
    id: "pattern024", name: "長期線タッチ反発", engineNames: ["長期線タッチ反発"], direction: "BUY", category: "移動平均線", difficulty: "INTERMEDIATE",
    summary: "上向きのEMA75付近まで調整した後、次足終値が前足高値を上回った押し目反発です。",
    formation: ["EMA75が上向いている", "前足がEMA75付近まで下落して終値を維持する", "次足終値がEMA75と前足高値を超える"],
    aiChecks: ["EMA75の傾き", "前足安値とEMA75の距離", "反発足の終値", "出来高"],
    cautions: ["下降中の長期線への接触は対象外", "長期線を終値で割り込んだ場合は反発前提が崩れる"],
    diagramPoints: "4,48 19,39 34,29 49,20 62,31 73,37 84,22 95,8",
  }),
  definePattern({
    id: "pattern027", name: "GU窓開け継続", engineNames: ["GU窓開け継続"], direction: "BUY", category: "ブレイクアウト", difficulty: "INTERMEDIATE",
    summary: "前セッション高値から窓を開けて始まり、窓を埋めず終値まで上昇を維持した状態です。",
    formation: ["前セッション高値から1%以上GUする", "寄付き後に窓を埋めない", "終値で寄付きからの上昇を維持する"],
    aiChecks: ["セッション境界", "前セッション高値と寄付きの差", "窓の維持", "終値と出来高"],
    cautions: ["時間境界を確認できない入力では検出しない", "寄付き後に窓を埋めた場合は対象外"],
    diagramPoints: "4,45 24,39 43,42 51,23 66,16 81,11 95,5",
  }),
  definePattern({
    id: "pattern028", name: "寄付き急騰継続", engineNames: ["寄付き急騰継続"], direction: "BUY", category: "ブレイクアウト", difficulty: "ADVANCED",
    summary: "分足の寄付き後5本以内に3%以上上昇し、出来高と高値圏を維持した短期継続パターンです。",
    formation: ["分足のセッション境界を確認する", "寄付きから5本以内に3%以上上昇する", "浅い押しと増加出来高で高値圏を維持する"],
    aiChecks: ["足間隔とセッション境界", "寄付きからの上昇率", "押しの深さ", "高値維持率と出来高"],
    cautions: ["日足では検出しない", "寄付き後の押しが1%を超える場合は対象外"],
    diagramPoints: "4,45 22,42 43,39 52,24 64,13 77,9 88,12 95,5",
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

function catalogTextTokens(pattern: ChartPatternCatalogItem) {
  const text = [...pattern.formation, ...pattern.aiChecks]
    .join(" ")
    .toLowerCase()
    .replace(/[\s・、。,.()（）/]+/g, "");
  const tokens = new Set<string>();

  for (let index = 0; index < text.length - 1; index += 1) {
    tokens.add(text.slice(index, index + 2));
  }

  return tokens;
}

export function getRelatedChartPatterns(
  current: ChartPatternCatalogItem,
  limit = 3,
) {
  const currentTokens = catalogTextTokens(current);

  return chartPatternCatalog
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => {
      const commonTerms = [...catalogTextTokens(candidate)].filter((token) =>
        currentTokens.has(token),
      ).length;
      const score =
        (candidate.category === current.category ? 1_000_000 : 0) +
        (candidate.direction === current.direction ? 10_000 : 0) +
        (candidate.difficulty === current.difficulty ? 100 : 0) +
        commonTerms;

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, Math.max(0, limit))
    .map(({ candidate }) => candidate);
}
