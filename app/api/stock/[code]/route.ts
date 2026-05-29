import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const symbol = `${code}.T`;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    const data = await response.json();

    const result = data.chart?.result?.[0];

    if (!result) {
      return NextResponse.json(
        { error: "Yahoo API error" },
        { status: 404 }
      );
    }

    const timestamps = result.timestamp;
    const prices = result.indicators.quote[0].close;

    const chartData = timestamps
      .map((time: number, index: number) => ({
        time: new Date(time * 1000).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        price: prices[index],
      }))
      .filter((item: { time: string; price: number | null }) => item.price !== null);

    const latest = chartData[chartData.length - 1];
    const first = chartData[0];

    const change = latest.price - first.price;

    const changeRate = ((change / first.price) * 100).toFixed(2);

    return NextResponse.json({
      code,
      name: code,
      price: latest.price,
      change,
      changeRate,
      chartData,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "サーバー側でエラーが発生しました" },
      { status: 500 }
    );
  }
}