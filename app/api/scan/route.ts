import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  name: string;
  score?: number;
  price?: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

const STOCKS: Stock[] = [
  { code: "7203", name: "トヨタ" },
  { code: "6758", name: "ソニーG" },
  { code: "9984", name: "ソフトバンクG" },
  { code: "8306", name: "三菱UFJ" },
  { code: "9432", name: "NTT" },
  { code: "7267", name: "ホンダ" },
  { code: "8058", name: "三菱商事" },
  { code: "6501", name: "日立" },
  { code: "8035", name: "東京エレクトロン" },
  { code: "7974", name: "任天堂" },
  { code: "4519", name: "中外製薬" },
{ code: "4063", name: "信越化学" },
{ code: "6098", name: "リクルート" },
{ code: "6861", name: "キーエンス" },
{ code: "9983", name: "ファーストリテイリング" },
{ code: "8411", name: "みずほFG" },
{ code: "8316", name: "三井住友FG" },
{ code: "8591", name: "オリックス" },
{ code: "2914", name: "JT" },
{ code: "5401", name: "日本製鉄" },
{ code: "7011", name: "三菱重工" },
{ code: "7012", name: "川崎重工" },
{ code: "7013", name: "IHI" },
{ code: "8001", name: "伊藤忠" },
{ code: "8031", name: "三井物産" },
{ code: "8053", name: "住友商事" },
{ code: "9101", name: "日本郵船" },
{ code: "9104", name: "商船三井" },
{ code: "9107", name: "川崎汽船" },
{ code: "1605", name: "INPEX" },
{ code: "8801", name: "三井不動産" },
{ code: "8802", name: "三菱地所" },
{ code: "1925", name: "大和ハウス" },
{ code: "1928", name: "積水ハウス" },
{ code: "4502", name: "武田薬品" },
{ code: "4503", name: "アステラス製薬" },
{ code: "4568", name: "第一三共" },
{ code: "4661", name: "オリエンタルランド" },
{ code: "4901", name: "富士フイルム" },
{ code: "6702", name: "富士通" },
{ code: "6701", name: "NEC" },
{ code: "6723", name: "ルネサス" },
{ code: "6954", name: "ファナック" },
{ code: "6981", name: "村田製作所" },
{ code: "6902", name: "デンソー" },
{ code: "7751", name: "キヤノン" },
{ code: "7733", name: "オリンパス" },
{ code: "6367", name: "ダイキン" },
{ code: "4452", name: "花王" },
{ code: "3382", name: "セブン&アイ" },
{ code: "9020", name: "JR東日本" },
{ code: "9021", name: "JR西日本" },
{ code: "9022", name: "JR東海" },


{ code: "9024", name: "西武HD" },
{ code: "9005", name: "東急" },
{ code: "9007", name: "小田急" },
{ code: "9008", name: "京王" },
{ code: "9009", name: "京成" },
{ code: "9023", name: "東京メトロ" },
{ code: "9613", name: "NTTデータ" },
{ code: "4689", name: "LINEヤフー" },
{ code: "4755", name: "楽天G" },
{ code: "4751", name: "サイバーエージェント" },
{ code: "3659", name: "ネクソン" },
{ code: "7832", name: "バンダイナムコ" },
{ code: "9766", name: "コナミG" },
{ code: "9697", name: "カプコン" },
{ code: "9684", name: "スクエニHD" },
{ code: "2413", name: "エムスリー" },
{ code: "2412", name: "ベネフィット・ワン" },
{ code: "4385", name: "メルカリ" },
{ code: "4384", name: "ラクスル" },
{ code: "4478", name: "フリー" },
{ code: "4483", name: "JMDC" },
{ code: "3697", name: "SHIFT" },
{ code: "4443", name: "Sansan" },
{ code: "2127", name: "日本M&A" },
{ code: "3994", name: "マネーフォワード" },
{ code: "2502", name: "アサヒGHD" },
{ code: "2503", name: "キリンHD" },
{ code: "2587", name: "サントリーBF" },
{ code: "2801", name: "キッコーマン" },
{ code: "2802", name: "味の素" },
{ code: "2871", name: "ニチレイ" },
{ code: "2269", name: "明治HD" },
{ code: "2282", name: "日本ハム" },
{ code: "2229", name: "カルビー" },
{ code: "2206", name: "江崎グリコ" },
{ code: "3064", name: "MonotaRO" },
{ code: "3092", name: "ZOZO" },
{ code: "3141", name: "ウエルシア" },
{ code: "3349", name: "コスモス薬品" },
{ code: "3397", name: "トリドール" },
{ code: "3563", name: "FOOD & LIFE" },
{ code: "7550", name: "ゼンショーHD" },
{ code: "8267", name: "イオン" },
{ code: "9843", name: "ニトリHD" },
{ code: "7532", name: "パンパシHD" },
{ code: "9201", name: "JAL" },
{ code: "9202", name: "ANA" },



{ code: "9501", name: "東京電力" },
{ code: "9502", name: "中部電力" },
{ code: "9503", name: "関西電力" },
{ code: "9531", name: "東京ガス" },
{ code: "9532", name: "大阪ガス" },


{ code: "4755", name: "楽天G" },
{ code: "4385", name: "メルカリ" },
{ code: "3778", name: "さくら" },
{ code: "5253", name: "カバー" },

{ code: "9508", name: "九州電力" },
{ code: "9509", name: "北海道電力" },
{ code: "9506", name: "東北電力" },
{ code: "9504", name: "中国電力" },
{ code: "9507", name: "四国電力" },
{ code: "9433", name: "KDDI" },
{ code: "9434", name: "ソフトバンク" },
{ code: "6178", name: "日本郵政" },
{ code: "7182", name: "ゆうちょ銀行" },
{ code: "7186", name: "コンコルディアFG" },
{ code: "5831", name: "しずおかFG" },
{ code: "5838", name: "楽天銀行" },
{ code: "8473", name: "SBIHD" },
{ code: "8604", name: "野村HD" },
{ code: "8601", name: "大和証券G" },
{ code: "8750", name: "第一生命HD" },
{ code: "8766", name: "東京海上HD" },
{ code: "8725", name: "MS&AD" },
{ code: "8630", name: "SOMPOHD" },
{ code: "8795", name: "T&DHD" },

{ code: "1801", name: "大成建設" },
{ code: "1802", name: "大林組" },
{ code: "1803", name: "清水建設" },
{ code: "1808", name: "長谷工" },
{ code: "1812", name: "鹿島" },
{ code: "1809", name: "奥村組" },
{ code: "1820", name: "西松建設" },
{ code: "1860", name: "戸田建設" },
{ code: "1861", name: "熊谷組" },
{ code: "1878", name: "大東建託" },

{ code: "3289", name: "東急不動産HD" },
{ code: "8804", name: "東京建物" },
{ code: "8830", name: "住友不動産" },
{ code: "3231", name: "野村不動産HD" },
{ code: "3003", name: "ヒューリック" },

{ code: "3402", name: "東レ" },
{ code: "3405", name: "クラレ" },
{ code: "3407", name: "旭化成" },
{ code: "4005", name: "住友化学" },
{ code: "4183", name: "三井化学" },
{ code: "4188", name: "三菱ケミカルG" },
{ code: "4204", name: "積水化学" },
{ code: "4612", name: "日本ペイントHD" },
{ code: "4911", name: "資生堂" },
{ code: "4922", name: "コーセー" },

{ code: "5019", name: "出光興産" },
{ code: "5020", name: "ENEOS" },
{ code: "5108", name: "ブリヂストン" },
{ code: "5201", name: "AGC" },
{ code: "5332", name: "TOTO" },
{ code: "5333", name: "日本ガイシ" },
{ code: "5713", name: "住友金属鉱山" },
{ code: "5802", name: "住友電工" },
{ code: "5803", name: "フジクラ" },
{ code: "6301", name: "コマツ" },

{ code: "6305", name: "日立建機" },
{ code: "6326", name: "クボタ" },
{ code: "6361", name: "荏原" },
{ code: "6503", name: "三菱電機" },
{ code: "6504", name: "富士電機" },
{ code: "6645", name: "オムロン" },
{ code: "6752", name: "パナソニックHD" },
{ code: "6753", name: "シャープ" },
{ code: "6762", name: "TDK" },
{ code: "6841", name: "横河電機" },

{ code: "6963", name: "ローム" },
{ code: "6971", name: "京セラ" },
{ code: "6988", name: "日東電工" },
{ code: "7014", name: "名村造船" },
{ code: "7201", name: "日産自動車" },
{ code: "7202", name: "いすゞ" },
{ code: "7211", name: "三菱自動車" },
{ code: "7270", name: "SUBARU" },
{ code: "7272", name: "ヤマハ発動機" },
{ code: "7261", name: "マツダ" },

{ code: "7453", name: "良品計画" },
{ code: "7459", name: "メディパルHD" },
{ code: "8113", name: "ユニ・チャーム" },
{ code: "8252", name: "丸井G" },
{ code: "8273", name: "イズミ" },
{ code: "8282", name: "ケーズHD" },
{ code: "9989", name: "サンドラッグ" },
{ code: "2651", name: "ローソン" },
{ code: "2670", name: "ABCマート" },
{ code: "3088", name: "マツキヨココカラ" },
];

let cache: any[] = [];
let lastFetch = 0;
const CACHE_TIME = 60 * 1000;

async function fetchYahooPrice(code: string) {
  const symbol = `${code}.T`;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1m`,
    { cache: "no-store" }
  );

  const data = await res.json();
  const result = data.chart?.result?.[0];

  const price =
    result?.meta?.regularMarketPrice ??
    result?.meta?.previousClose ??
    null;

  const previousClose = result?.meta?.previousClose ?? null;

  return {
    price,
    previousClose,
    marketState: result?.meta?.marketState ?? null,
  };
}

function judgeStock(params: {
  code: string;
  name: string;
  price: number;
  previousClose: number | null;
}) {
  const { code, name, price, previousClose } = params;

  const changePercent =
    previousClose && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : 0;

  let score = 50;
  const reasons: string[] = [];

  if (changePercent >= 2) {
    score += 25;
    reasons.push("上昇率が強い");
  } else if (changePercent >= 1) {
    score += 15;
    reasons.push("上昇傾向");
  } else if (changePercent <= -2) {
    score -= 20;
    reasons.push("下落が強い");
  } else {
    reasons.push("値動きは通常範囲");
  }

  if (price > 0 && price <= 1000) {
    score += 5;
    reasons.push("10万円以下で100株を狙いやすい");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
  code,
  name,
  score,
  price,
  changePercent: Number(changePercent.toFixed(2)),
  rsi: 50,
  volumeRatio: 1,
  reason: reasons.join("・"),

  takeProfit: Math.round(price * 1.03),
  stopLoss: Math.round(price * 0.98),
};
}

export async function GET() {
  const now = Date.now();

  if (cache.length > 0 && now - lastFetch < CACHE_TIME) {
    return NextResponse.json({
      success: true,
      cached: true,
      stocks: cache,
    });
  }

  const results = await Promise.allSettled(
    STOCKS.map(async (stock) => {
      const quote = await fetchYahooPrice(stock.code);

      if (!quote.price) return null;

      return judgeStock({
        code: stock.code,
        name: stock.name,
        price: quote.price,
        previousClose: quote.previousClose,
      });
    })
  );

  const stocks = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score);

  cache = stocks;
  lastFetch = now;

  return NextResponse.json({
    success: true,
    cached: false,
    count: stocks.length,
    stocks,
  });
}