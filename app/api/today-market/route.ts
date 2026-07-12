export const dynamic = "force-dynamic";

const SCAN_TIMEOUT_MS = 12_000;

function getPower(stock: any) {
  return Number(
    stock?.score ??
      stock?.aiPower ??
      stock?.power ??
      stock?.totalScore ??
      0
  );
}

function getExpected(stock: any) {
  if (stock?.expected) return String(stock.expected);
  if (stock?.expectedProfit) return String(stock.expectedProfit);

  const takeProfit = Number(stock?.takeProfit);
  const price = Number(stock?.price);

  if (Number.isFinite(takeProfit) && Number.isFinite(price) && price > 0) {
    return `+${(((takeProfit - price) / price) * 100).toFixed(1)}%`;
  }

  return "+0.0%";
}

function createFallbackResponse(error?: unknown) {
  return Response.json({
    success: false,
    grade: "C",
    action: "様子見",
    marketCondition: "中立",
    hotCount: 0,
    watchCount: 0,
    top5: [],
    stocks: [],
    topStock: {
      code: "",
      name: "取得中",
      aiPower: 0,
      expected: "+0.0%",
      judge: "様子見",
    },
    strategy: ["無理に買わない", "候補を確認", "押し目を待つ"],
    avoid: ["高値追い", "飛び乗り", "無理なエントリー"],
    comment:
      "市場データを取得できませんでした。安全のため様子見判定にしています。",
    updatedAt: new Date().toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    error: error instanceof Error ? error.message : String(error ?? ""),
  });
}

export async function GET(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const url = new URL(request.url);
    const scanUrl = `${url.origin}/api/scan?limit=20&top=20`;

    const scanRes = await fetch(scanUrl, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!scanRes.ok) {
      throw new Error(`scan API failed: ${scanRes.status}`);
    }

    const scanData = await scanRes.json();

    const stocks = Array.isArray(scanData)
      ? scanData
      : Array.isArray(scanData?.stocks)
        ? scanData.stocks
        : Array.isArray(scanData?.results)
          ? scanData.results
          : Array.isArray(scanData?.data)
            ? scanData.data
            : [];

    if (stocks.length === 0) {
      throw new Error("stocks is empty");
    }

    const sorted = [...stocks]
      .filter(Boolean)
      .sort((a: any, b: any) => getPower(b) - getPower(a));

    const top = sorted[0];
    const topPower = getPower(top);

    const normalizedStocks = sorted.map((stock: any) => ({
      ...stock,
      code: String(stock?.code ?? ""),
      name: String(stock?.name ?? "名称不明"),
      score: getPower(stock),
      aiPower: getPower(stock),
      expected: getExpected(stock),
    }));

    const top5 = normalizedStocks.slice(0, 5).map((stock: any, index: number) => ({
      rank: index + 1,
      code: stock.code,
      name: stock.name,
      aiPower: stock.aiPower,
      score: stock.score,
      price: stock?.price ?? null,
      changePercent: stock?.changePercent ?? null,
      reason: stock?.reason ?? "",
      expected: stock.expected,
    }));

    const hotCount = normalizedStocks.filter(
      (stock: any) => getPower(stock) >= 80
    ).length;

    const watchCount = normalizedStocks.filter((stock: any) => {
      const power = getPower(stock);
      return power >= 75 && power < 80;
    }).length;

    let grade = "D";
    let action = "休む日";

    if (topPower >= 80) {
      grade = "A";
      action = "攻める日";
    } else if (topPower >= 75) {
      grade = "B";
      action = "慎重に攻める日";
    } else if (topPower >= 65) {
      grade = "C";
      action = "厳選の日";
    }

    const marketCondition =
      grade === "A"
        ? "強気"
        : grade === "B"
          ? "やや強気"
          : grade === "C"
            ? "中立"
            : "弱気";

    const judge =
      topPower >= 80
        ? "買い候補"
        : topPower >= 75
          ? "押し目待ち"
          : topPower >= 65
            ? "様子見"
            : "見送り";

    return Response.json({
      success: true,
      grade,
      action,
      marketCondition,
      hotCount,
      watchCount,
      top5,
      stocks: normalizedStocks,
      topStock: {
        code: String(top?.code ?? ""),
        name: String(top?.name ?? "名称不明"),
        aiPower: topPower,
        expected: getExpected(top),
        judge,
      },
      strategy:
        grade === "D"
          ? ["無理に買わない", "現金を守る", "次の好機を待つ"]
          : ["押し目買い", "AI POWER上位を確認", "高値掴みを避ける"],
      avoid: ["高値追い", "飛び乗り", "無理なエントリー"],
      comment:
        grade === "D"
          ? "今日は強い買い候補が少ないため、無理に売買せず次の好機を待つ戦略が有効です。"
          : `本日の大本命は${top?.code} ${top?.name}です。AI POWERは${topPower}。高値追いは避け、押し目を待ちながら慎重に判断しましょう。`,
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } catch (error) {
    console.error("today-market error:", error);
    return createFallbackResponse(error);
  } finally {
    clearTimeout(timeoutId);
  }
}