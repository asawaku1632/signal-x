export async function GET() {
  return Response.json({
    success: true,

    total: 962,
    win: 0,
    lose: 1,
    hold: 961,
    winRate: 0,

    growth: 12,
    dateCount: 1,

    bestStocks: [
      {
        code: "9501",
        name: "東京電力",
        winRate: 91,
        total: 22,
      },
      {
        code: "6758",
        name: "ソニーG",
        winRate: 84,
        total: 19,
      },
      {
        code: "5401",
        name: "日本製鉄",
        winRate: 78,
        total: 25,
      },
    ],

    worstStocks: [
      {
        code: "9984",
        name: "ソフトバンクG",
        winRate: 34,
        total: 18,
      },
      {
        code: "7203",
        name: "トヨタ",
        winRate: 38,
        total: 21,
      },
      {
        code: "8035",
        name: "東エレク",
        winRate: 42,
        total: 16,
      },
    ],

    winRateTrend: [
      { label: "1日目", value: 0 },
      { label: "2日目", value: 12 },
      { label: "3日目", value: 24 },
      { label: "4日目", value: 38 },
      { label: "5日目", value: 51 },
      { label: "6日目", value: 63 },
      { label: "7日目", value: 75 },
    ],

    comment:
      "AIは現在データ蓄積中です。検証数が増えるほど、得意銘柄・苦手銘柄の判定精度が上がります。",

    updatedAt: new Date().toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
}