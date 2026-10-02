import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { withSingleLineBrand } from "@/app/lib/line/brand";
import { getPublicBaseUrl } from "@/app/lib/publicBaseUrl";
import {
  isTseTradingDate,
  resolveTseTradingDatesAfter,
} from "@/app/lib/technicalObservation/tseMarketCalendar";

type Stock = {
  code: string;
  name?: string;
  price?: number;
  score?: number;
  aiPower?: number;
  rawAiPower?: number;
  changePercent?: number;
  volumeRatio?: number;
  patternSignal?: string;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

type SavedCandidate = {
  code: string;
  name: string;
  score: number;
  price: number;
};

type PreviousReportRow = {
  report_date: string | Date;
  candidates: SavedCandidate[];
};

const ROUTE = "/api/cron/night-market-report";
const ALLOWED_START_MINUTE = 18 * 60 + 50;
const ALLOWED_END_MINUTE = 19 * 60 + 30;

function jstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  return {
    date,
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function scoreOf(stock: Stock) {
  return Number(stock.rawAiPower ?? stock.score ?? stock.aiPower ?? 0);
}

function yen(value?: number) {
  if (!Number.isFinite(Number(value))) return "-";
  return `${Math.round(Number(value)).toLocaleString()}円`;
}

function signedPercent(value?: number) {
  if (!Number.isFinite(Number(value))) return "-";
  const n = Number(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function marketJudge(stats: {
  sRank: number;
  buyCandidates: number;
  wBreak: number;
  volumeHot: number;
}) {
  if (stats.sRank >= 3 || stats.buyCandidates >= 50) return "強気";
  if (stats.sRank >= 1 || stats.buyCandidates >= 20) return "やや強気";
  if (stats.buyCandidates >= 5 || stats.wBreak >= 5) return "中立";
  return "慎重";
}

function nextMorningOutlook(
  stats: { sRank: number; buyCandidates: number; wBreak: number; volumeHot: number },
  top3: Stock[],
) {
  const avgScore = top3.length
    ? top3.reduce((sum, stock) => sum + scoreOf(stock), 0) / top3.length
    : 0;

  if (stats.sRank >= 3 && stats.wBreak >= 10) {
    return "強い候補が複数あります。寄り付き直後の高値追いは避け、上位候補の押し目と出来高継続を確認したい場面です。";
  }
  if (stats.buyCandidates >= 20 || avgScore >= 90) {
    return "注目候補は多めです。寄り付き後の方向と出来高を確認し、抵抗線を明確に上抜ける銘柄を優先して見たい状況です。";
  }
  if (stats.buyCandidates >= 5) {
    return "候補は絞られています。上位銘柄の寄り付きと支持線を確認し、条件がそろうまで焦らず待つのが基本です。";
  }
  return "強い候補は少なめです。無理なエントリーより、新しい買い条件や出来高増加が出るまで待つ展開を想定します。";
}

function candidateReason(stock: Stock) {
  const parts: string[] = [];
  if (stock.patternSignal === "W_BOTTOM_BREAK") parts.push("W突破");
  if (Number(stock.volumeRatio ?? 0) >= 2) parts.push(`出来高${Number(stock.volumeRatio).toFixed(1)}倍`);
  if (Number(stock.changePercent ?? 0) > 0) parts.push(`前日比${signedPercent(stock.changePercent)}`);
  return parts.length ? parts.join("・") : "AI POWER上位";
}

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 500, text: "LINE token missing" };
  const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: [{ type: "text", text: message }] }),
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.signalx_night_market_reports (
      report_date DATE PRIMARY KEY,
      market_judge TEXT NOT NULL,
      stats JSONB NOT NULL,
      candidates JSONB NOT NULL,
      sending_started_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function previousReport(today: string) {
  const result = await pool.query<PreviousReportRow>(`
    SELECT report_date, candidates
    FROM public.signalx_night_market_reports
    WHERE report_date < $1::date
      AND sent_at IS NOT NULL
    ORDER BY report_date DESC
    LIMIT 1
  `, [today]);
  return result.rows[0] ?? null;
}

function previousResultText(previous: PreviousReportRow | null, stocks: Stock[]) {
  if (!previous?.candidates?.length) return "";
  let up = 0;
  let down = 0;
  let flat = 0;
  const lines = previous.candidates.slice(0, 3).map((candidate) => {
    const current = stocks.find((stock) => String(stock.code) === String(candidate.code));
    const currentPrice = Number(current?.price ?? 0);
    if (!candidate.price || !currentPrice) {
      return `・${candidate.code} ${candidate.name}　結果取得待ち`;
    }
    const pct = ((currentPrice / candidate.price) - 1) * 100;
    if (pct > 0.05) up += 1;
    else if (pct < -0.05) down += 1;
    else flat += 1;
    return `・${candidate.code} ${candidate.name}　${signedPercent(pct)}`;
  });

  const reportDate = new Date(previous.report_date).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });

  return (
    `\n📌 前回（${reportDate}）の超有望候補結果\n` +
    `${lines.join("\n")}\n` +
    `→ 上昇${up}・下落${down}${flat ? `・横ばい${flat}` : ""}\n`
  );
}

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const jst = jstParts(now);
  const force = new URL(req.url).searchParams.get("force") === "1";

  if (!isTseTradingDate(jst.date)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "TSE_MARKET_CLOSED",
      date: jst.date,
    });
  }

  if (!force && (jst.minuteOfDay < ALLOWED_START_MINUTE || jst.minuteOfDay > ALLOWED_END_MINUTE)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "OUTSIDE_NIGHT_REPORT_WINDOW",
      date: jst.date,
      jstTime: jst.time,
      allowed: "18:50-19:30",
    });
  }

  await ensureTable();

  const alreadySent = await pool.query<{ sent_at: Date | null }>(`
    SELECT sent_at
    FROM public.signalx_night_market_reports
    WHERE report_date = $1::date
    LIMIT 1
  `, [jst.date]);

  if (alreadySent.rows[0]?.sent_at) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "ALREADY_SENT",
      date: jst.date,
    });
  }

  const baseUrl = getPublicBaseUrl();
  const scanResponse = await fetch(`${baseUrl}/api/scan?limit=1000`, { cache: "no-store" });
  if (!scanResponse.ok) {
    return NextResponse.json(
      { success: false, error: "scan api failed", status: scanResponse.status },
      { status: 500 },
    );
  }

  const scanJson = await scanResponse.json();
  const stocks: Stock[] = Array.isArray(scanJson)
    ? scanJson
    : Array.isArray(scanJson?.stocks)
      ? scanJson.stocks
      : [];

  if (!stocks.length) {
    return NextResponse.json({ success: true, skipped: true, reason: "NO_STOCKS" });
  }

  const ranked = [...stocks].sort((a, b) =>
    scoreOf(b) - scoreOf(a) ||
    Number(b.changePercent ?? 0) - Number(a.changePercent ?? 0) ||
    Number(b.volumeRatio ?? 0) - Number(a.volumeRatio ?? 0)
  );
  const top3 = ranked.slice(0, 3);
  const stats = {
    total: stocks.length,
    sRank: stocks.filter((stock) => scoreOf(stock) >= 95).length,
    buyCandidates: stocks.filter((stock) => scoreOf(stock) >= 85).length,
    wBreak: stocks.filter((stock) => stock.patternSignal === "W_BOTTOM_BREAK").length,
    volumeHot: stocks.filter((stock) => Number(stock.volumeRatio ?? 0) >= 2).length,
  };
  const judge = marketJudge(stats);
  const topGainer = [...stocks]
    .filter((stock) => Number.isFinite(Number(stock.changePercent)))
    .sort((a, b) => Number(b.changePercent ?? 0) - Number(a.changePercent ?? 0))[0];
  const volumeLeader = [...stocks]
    .filter((stock) => Number.isFinite(Number(stock.volumeRatio)))
    .sort((a, b) => Number(b.volumeRatio ?? 0) - Number(a.volumeRatio ?? 0))[0];

  const nextTradingDate = resolveTseTradingDatesAfter(jst.date, 1)[0];
  const nextDateLabel = new Date(`${nextTradingDate}T00:00:00+09:00`).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });

  const savedCandidates: SavedCandidate[] = top3.map((stock) => ({
    code: String(stock.code),
    name: String(stock.name ?? stock.code),
    score: scoreOf(stock),
    price: Number(stock.price ?? 0),
  }));

  await pool.query(`
    INSERT INTO public.signalx_night_market_reports
      (report_date, market_judge, stats, candidates, updated_at)
    VALUES ($1::date, $2, $3::jsonb, $4::jsonb, NOW())
    ON CONFLICT (report_date)
    DO UPDATE SET
      market_judge = EXCLUDED.market_judge,
      stats = EXCLUDED.stats,
      candidates = EXCLUDED.candidates,
      updated_at = NOW()
  `, [jst.date, judge, JSON.stringify(stats), JSON.stringify(savedCandidates)]);

  const claim = await pool.query(`
    UPDATE public.signalx_night_market_reports
    SET sending_started_at = NOW(), updated_at = NOW()
    WHERE report_date = $1::date
      AND sent_at IS NULL
      AND (
        sending_started_at IS NULL
        OR sending_started_at < NOW() - INTERVAL '15 minutes'
      )
    RETURNING report_date
  `, [jst.date]);

  if (!claim.rowCount) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "SEND_IN_PROGRESS",
      date: jst.date,
    });
  }

  const previous = await previousReport(jst.date);
  const previousText = previousResultText(previous, stocks);

  const candidateLines = top3.map((stock, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
    return (
      `${medal} ${stock.code} ${stock.name ?? ""}\n` +
      `AI POWER ${scoreOf(stock).toFixed(1)}｜${yen(stock.price)}｜${signedPercent(stock.changePercent)}\n` +
      `${candidateReason(stock)}\n` +
      `${baseUrl}/analysis/${encodeURIComponent(stock.code)}`
    );
  }).join("\n\n");

  const message = withSingleLineBrand(
    `🌙 SIGNALX 夜のマーケットレポート\n` +
    `━━━━━━━━━━━━━━\n` +
    `📅 ${jst.date}\n\n` +
    `📊 今日の市場：${judge}\n` +
    `Sランク ${stats.sRank}｜買い候補 ${stats.buyCandidates}\n` +
    `W突破 ${stats.wBreak}｜出来高急増 ${stats.volumeHot}\n\n` +
    `🔎 今日の振り返り\n` +
    `📈 上昇率トップ：${topGainer ? `${topGainer.code} ${topGainer.name ?? ""} ${signedPercent(topGainer.changePercent)}` : "-"}\n` +
    `🔥 出来高トップ：${volumeLeader ? `${volumeLeader.code} ${volumeLeader.name ?? ""} ${Number(volumeLeader.volumeRatio ?? 0).toFixed(1)}倍` : "-"}\n` +
    previousText +
    `\n👑 次の取引日の超有望候補 TOP3\n` +
    `━━━━━━━━━━━━━━\n` +
    `${candidateLines}\n\n` +
    `🌅 ${nextDateLabel} 朝のAI見通し\n` +
    `${nextMorningOutlook(stats, top3)}\n\n` +
    `⚠️ 上昇を保証する予測ではありません。寄り付き後の価格・出来高・支持線/抵抗線も確認してください。\n\n` +
    `📊 AIランキングを見る\n` +
    `${baseUrl}/ranking`
  );

  const line = await sendLine(message);

  if (line.ok) {
    await pool.query(`
      UPDATE public.signalx_night_market_reports
      SET sent_at = NOW(), sending_started_at = NULL, updated_at = NOW()
      WHERE report_date = $1::date
    `, [jst.date]);
  } else {
    await pool.query(`
      UPDATE public.signalx_night_market_reports
      SET sending_started_at = NULL, updated_at = NOW()
      WHERE report_date = $1::date
    `, [jst.date]);
  }

  return NextResponse.json({
    success: line.ok,
    route: ROUTE,
    date: jst.date,
    nextTradingDate,
    marketJudge: judge,
    stats,
    candidates: savedCandidates,
    lineStatus: line.status,
    response: line.text,
    messagePreview: message,
  }, { status: line.ok ? 200 : 502 });
}
