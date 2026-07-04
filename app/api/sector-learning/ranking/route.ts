import { NextRequest, NextResponse } from "next/server";
import { rankSectors } from "@/app/lib/sectorRanking";

function getRankLabel(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}位`;
}

function getFlowLabel(aiScore: number) {
  if (aiScore >= 90) return "資金流入・最強";
  if (aiScore >= 70) return "資金流入・強い";
  if (aiScore >= 50) return "中立";
  if (aiScore >= 30) return "弱い";
  return "資金流出";
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = new URL(req.url).origin;

    const res = await fetch(
      `${baseUrl}/api/sector-learning/dashboard`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!data.success) {
      throw new Error("SECTOR_DASHBOARD_FAILED");
    }

    const sectors = data.sectors ?? [];

    const ranking = rankSectors(
      sectors.map((sector: any) => ({
        sectorKey: sector.sectorKey,
        sectorName: sector.sectorName,
        winRate: Number(sector.winRate ?? 0),
        aiBonus: Number(sector.aiBonus ?? 0),
        confidence: Number(sector.confidence ?? 0),
        total: Number(sector.total ?? 0),
      }))
    ).map((sector, index) => ({
      rank: index + 1,
      rankLabel: getRankLabel(index),
      sectorKey: sector.sectorKey,
      sectorName: sector.sectorName,
      aiScore: sector.aiScore,
      flowLabel: getFlowLabel(sector.aiScore),
      winRate: sector.winRate,
      aiBonus: sector.aiBonus,
      confidence: sector.confidence,
      total: sector.total,
    }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.7_SECTOR_RANKING_AI",
      sectorCount: ranking.length,
      ranking,
    });
  } catch (error) {
    console.error("sector ranking error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.7_SECTOR_RANKING_AI",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}