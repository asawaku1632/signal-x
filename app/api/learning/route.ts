import { NextResponse } from "next/server";

type LearningData = {
  pattern: string;

  detected: number;

  wins: number;

  losses: number;

  winRate: number;
};

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const res = await fetch(
      `${baseUrl}/api/scan`,
      {
        cache: "no-store",
      }
    );

    const json = await res.json();

    const stocks = json.stocks || [];

    const learningMap: Record<
      string,
      LearningData
    > = {};

    const registerPattern = (
      pattern: string,
      isWin: boolean
    ) => {
      if (!learningMap[pattern]) {
        learningMap[pattern] = {
          pattern,

          detected: 0,

          wins: 0,

          losses: 0,

          winRate: 0,
        };
      }

      learningMap[pattern].detected += 1;

      if (isWin) {
        learningMap[pattern].wins += 1;
      } else {
        learningMap[pattern].losses += 1;
      }

      const data =
        learningMap[pattern];

      data.winRate = Number(
        (
          (data.wins /
            Math.max(
              data.detected,
              1
            )) *
          100
        ).toFixed(1)
      );
    };

    for (const stock of stocks) {
      const score =
        stock.score || 0;

      const patterns =
        stock.patterns || {};

      const isWin = score >= 70;

      for (const key of Object.keys(
        patterns
      )) {
        if (patterns[key]) {
          registerPattern(
            key,
            isWin
          );
        }
      }
    }

    const learning =
      Object.values(
        learningMap
      ).sort(
        (a, b) =>
          b.winRate - a.winRate
      );

    return NextResponse.json({
      success: true,

      learning,

      updatedAt: new Date(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,

        learning: [],
      },
      {
        status: 500,
      }
    );
  }
}