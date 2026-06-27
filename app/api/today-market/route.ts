export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;

    const scanUrl = `${origin}/api/scan?limit=1000`;

    const scanRes = await fetch(scanUrl, {
      cache: "no-store",
    });

    if (!scanRes.ok) {
      throw new Error(`scan API failed: ${scanRes.status}`);
    }

    const scanData = await scanRes.json();

    const stocks = Array.isArray(scanData)
      ? scanData
      : Array.isArray(scanData.stocks)
      ? scanData.stocks
      : Array.isArray(scanData.results)
      ? scanData.results
      : Array.isArray(scanData.data)
      ? scanData.data
      : [];

    if (!stocks.length) {
      throw new Error("stocks is empty");
    }

    const getPower = (stock: any) => {
      return Number(
        stock.score ??
          stock.aiPower ??
          stock.power ??
          stock.totalScore ??
          0
      );
    };

    const getExpected = (stock: any) => {
      if (stock?.expected) return stock.expected;
      if (stock?.expectedProfit) return stock.expectedProfit;

      if (stock?.takeProfit && stock?.price) {
        return `+${(((stock.takeProfit - stock.price) / stock.price) * 100).toFixed(1)}%`;
      }

      return "+0.0%";
    };

    const sorted = stocks
      .filter((stock: any) => stock)
      .sort((a: any, b: any) => getPower(b) - getPower(a));

    const top = sorted[0];
    const topPower = getPower(top);

    const top5 = sorted.slice(0, 5).map((stock: any, index: number) => {
      return {
        rank: index + 1,
        code: String(stock?.code ?? ""),
        name: String(stock?.name ?? "名称不明"),
        aiPower: getPower(stock),
        price: stock?.price ?? null,
        changePercent: stock?.changePercent ?? null,
        reason: stock?.reason ?? "",
        expected: getExpected(stock),
      };
    });

    const hotCount = sorted.filter((stock: any) => {
      return getPower(stock) >= 80;
    }).length;

    const watchCount = sorted.filter((stock: any) => {
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
      grade,
      action,
      marketCondition,
      hotCount,
      watchCount,
      top5,
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
  } catch (error: any) {
    console.error("today-market error:", error);

    return Response.json({
      grade: "C",
      action: "様子見",
      marketCondition: "中立",
      hotCount: 0,
      watchCount: 0,
      top5: [],
      topStock: {
        code: "5401",
        name: "日本製鉄",
        aiPower: 92,
        expected: "+7.8%",
        judge: "様子見",
      },
      strategy: ["無理に買わない", "候補を確認", "押し目を待つ"],
      avoid: ["高値追い", "飛び乗り", "無理なエントリー"],
      comment:
        "市場データ取得に失敗しました。現在は安全のため様子見判定にしています。",
      updatedAt: new Date().toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }
}