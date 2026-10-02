import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { withSingleLineBrand } from "@/app/lib/line/brand";
import { getPublicBaseUrl } from "@/app/lib/publicBaseUrl";
import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Stock = {
  code: string;
  name: string;
  price?: number;
  score?: number;
  aiPower?: number;
  rawAiPower?: number;
  changePercent?: number;
  volumeRatio?: number;
  patternSignal?: string;
  takeProfit?: number;
  stopLoss?: number;
};

type PreviousCandidateRow = {
  report_date: Date | string;
  rank: number;
  code: string;
  name: string;
  price: number | string;
  ai_power: number | string;
};

const ROUTE = "/api/cron/evening-report";
const SEND_START_MINUTE = 18 * 60 + 50;
const SEND_END_MINUTE = 19 * 60 + 45;

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
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour,
    minute,
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

function pct(value?: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function rankLabel(score: number) {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function buildMarketReview(input: {
  sRank: number;
  buyCandidates: number;
  wBreak: number;
  volumeHot: number;
}) {
  if (input.sRank >= 3 || input.buyCandidates >= 40) {
    return "AI高評価の候補が多め。強い銘柄とそうでない銘柄の差を見ながら、上位候補を優先して確認したい1日でした。";
  }
  if (input.sRank >= 1 || input.buyCandidates >= 15) {
    return "有望候補は出ていますが、全面的というより選別色のある状態。個別銘柄の形を重視したい局面です。";
  }
  return "高評価候補は少なめ。無理に追わず、条件が整う銘柄を待つ姿勢を優先したい状態です。";
}

function buildTomorrowOutlook(top3: Stock[], counts: {
  sRank: number;
  buyCandidates: number;
  wBreak: number;
  volumeHot: number;
}) {
  const topScore = top3[0] ? scoreOf(top3[0]) : 0;
  const topHasBreakout = top3.some((stock) => stock.patternSignal === "W_BOTTOM_BREAK");
  const topHasVolume = top3.some((stock) => Number(stock.volumeRatio ?? 0) >= 2);

  if (topScore >= 95 && (topHasBreakout || topHasVolume)) {
    return "AI評価上位にテクニカルの追い風もあります。明朝は寄り付き直後の急騰を追わず、前日終値との乖離と出来高を確認してから判断するのがポイントです。";
  }
  if (counts.sRank > 0 || counts.buyCandidates >= 15) {
    return "明朝は上位候補の寄り付きと出来高を優先確認。高く始まりすぎた場合は追いかけず、押し目や支持線付近の動きを見たいところです。";
  }
  return "明朝は候補を絞って確認する日。寄り付きの方向だけで決めず、出来高・支持線・抵抗線が揃うかを見てから判断したい状態です。";
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evening_report_deliveries (
      report_date DATE PRIMARY KEY,
      status TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      error TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evening_report_candidates (
      report_date DATE NOT NULL,
      rank INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      ai_power DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_date, rank)
    )
  `);
}

async function claimReport(reportDate: string) {
  await ensureTables();
  const result = await pool.query<{ status: string }>(`
    INSERT INTO evening_report_deliveries (report_date, status, claimed_at, updated_at)
    VALUES ($1, 'SENDING', NOW(), NOW())
    ON CONFLICT (report_date)
    DO UPDATE SET
      status = 'SENDING',
      claimed_at = NOW(),
      error = NULL,
      updated_at = NOW()
    WHERE evening_report_deliveries.status <> 'SENT'
      AND (
        evening_report_deliveries.status <> 'SENDING'
        OR evening_report_deliveries.claimed_at < NOW() - INTERVAL '10 minutes'
      )
    RETURNING status
  `, [reportDate]);
  return Boolean(result.rows[0]);
}

async function markSent(reportDate: string) {
  await pool.query(`
    UPDATE evening_report_deliveries
    SET status = 'SENT', sent_at = NOW(), error = NULL, updated_at = NOW()
    WHERE report_date = $1
  `, [reportDate]);
}

async function markFailed(reportDate: string, error: string) {
  await pool.query(`
    UPDATE evening_report_deliveries
    SET status = 'FAILED', error = $2, updated_at = NOW()
    WHERE report_date = $1
  `, [reportDate, error.slice(0, 1000)]);
}

async function getPreviousCandidates(reportDate: string) {
  const result = await pool.query<PreviousCandidateRow>(`
    SELECT report_date, rank, code, name, price, ai_power
    FROM evening_report_candidates
    WHERE report_date = (
      SELECT MAX(report_date)
      FROM evening_report_candidates
      WHERE report_date < $1
    )
    ORDER BY rank ASC
  `, [reportDate]);
  return result.rows;
}

async function saveCandidates(reportDate: string, stocks: Stock[]) {
  for (let index = 0; index < stocks.length; index += 1) {
    const stock = stocks[index];
    await pool.query(`
      INSERT INTO evening_report_candidates
        (report_date, rank, code, name, price, ai_power)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (report_date, rank)
      DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        ai_power = EXCLUDED.ai_power
    `, [
      reportDate,
      index + 1,
      stock.code,
      stock.name,
      Number(stock.price ?? 0),
      scoreOf(stock),
    ]);
  }
}

async function sendLineBroadcast(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 500, text: "LINE token missing" };

  let lastText = "";
  let lastStatus = 500;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: [{ type: "text", text: message }] }),
      signal: AbortSignal.timeout(25_000),
    });
    lastStatus = response.status;
    lastText = await response.text();
    if (response.ok) return { ok: true, status: response.status, text: lastText };
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  return { ok: false, status: lastStatus, text: lastText };
}

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const jst = jstParts(now);
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!isTseTradingDate(jst.date)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "TSE_MARKET_CLOSED",
      date: jst.date,
    });
  }

  const minuteOfDay = jst.hour * 60 + jst.minute;
  if (!force && (minuteOfDay < SEND_START_MINUTE || minuteOfDay > SEND_END_MINUTE)) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "OUTSIDE_EVENING_REPORT_WINDOW",
      date: jst.date,
      jstTime: jst.time,
    });
  }

  const claimed = await claimReport(jst.date);
  if (!claimed) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "ALREADY_SENT_OR_IN_PROGRESS",
      date: jst.date,
    });
  }

  try {
    const baseUrl = getPublicBaseUrl();
    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, { cache: "no-store" });
    if (!scanRes.ok) throw new Error(`scan api failed: ${scanRes.status}`);

    const scanJson = await scanRes.json();
    const stocks: Stock[] = Array.isArray(scanJson?.stocks) ? scanJson.stocks : [];
    if (!stocks.length) throw new Error("scan api returned no stocks");

    const ranked = [...stocks].sort((a, b) =>
      scoreOf(b) - scoreOf(a) ||
      Number(b.changePercent ?? 0) - Number(a.changePercent ?? 0) ||
      Number(b.volumeRatio ?? 0) - Number(a.volumeRatio ?? 0)
    );
    const top3 = ranked.slice(0, 3);

    const counts = {
      sRank: stocks.filter((stock) => scoreOf(stock) >= 95).length,
      buyCandidates: stocks.filter((stock) => scoreOf(stock) >= 85).length,
      wBreak: stocks.filter((stock) => stock.patternSignal === "W_BOTTOM_BREAK").length,
      volumeHot: stocks.filter((stock) => Number(stock.volumeRatio ?? 0) >= 2).length,
    };

    const previous = await getPreviousCandidates(jst.date);
    const previousDate = previous[0]
      ? new Date(previous[0].report_date).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      : null;
    const previousResults = previous.map((row) => {
      const current = stocks.find((stock) => String(stock.code) === String(row.code));
      const oldPrice = Number(row.price);
      const currentPrice = Number(current?.price ?? 0);
      const change = oldPrice > 0 && currentPrice > 0 ? (currentPrice / oldPrice - 1) * 100 : null;
      return { row, currentPrice, change };
    }).filter((item) => item.change !== null);

    const previousSection = previousResults.length
      ? (() => {
          const up = previousResults.filter((item) => Number(item.change) > 0).length;
          const down = previousResults.filter((item) => Number(item.change) < 0).length;
          const lines = previousResults.map((item, index) => {
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
            return `${medal} ${item.row.code} ${item.row.name}　${pct(Number(item.change))}`;
          }).join("\n");
          return `📌 前回（${previousDate}）の超有望候補\n${lines}\n→ ${up}銘柄上昇 / ${down}銘柄下落`;
        })()
      : "📌 前回候補の実績\nデータ蓄積を開始しました。次回から前回候補の騰落を表示します。";

    const top3Text = top3.map((stock, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
      const score = scoreOf(stock);
      const extras = [
        stock.patternSignal === "W_BOTTOM_BREAK" ? "W突破" : null,
        Number(stock.volumeRatio ?? 0) >= 2 ? `出来高${Number(stock.volumeRatio).toFixed(1)}倍` : null,
      ].filter(Boolean).join("・");
      return (
        `${medal} ${stock.code} ${stock.name}\n` +
        `AI POWER ${score.toFixed(1)}｜${rankLabel(score)}ランク｜${yen(stock.price)} ${pct(stock.changePercent)}` +
        (extras ? `\n${extras}` : "") +
        `\n${baseUrl}/analysis/${stock.code}`
      );
    }).join("\n\n");

    const marketReview = buildMarketReview(counts);
    const tomorrowOutlook = buildTomorrowOutlook(top3, counts);

    const message = withSingleLineBrand(
      `🌙 SIGNALX 夜のマーケットレポート\n` +
      `${jst.date} 19:00\n\n` +
      `📊 今日の市場まとめ\n` +
      `Sランク ${counts.sRank}｜買い候補 ${counts.buyCandidates}\n` +
      `W突破 ${counts.wBreak}｜出来高急増 ${counts.volumeHot}\n\n` +
      `📝 今日の振り返り\n${marketReview}\n\n` +
      `👑 明日の超有望候補 TOP3\n` +
      `※今日の終値時点のAI評価です\n\n` +
      `${top3Text}\n\n` +
      `🌅 明日の朝の見通し\n${tomorrowOutlook}\n\n` +
      `${previousSection}\n\n` +
      `📈 ランキングを確認\n${baseUrl}/ranking\n\n` +
      `※候補は上昇を保証するものではありません。寄り付き・出来高・支持線/抵抗線を確認して判断してください。`
    );

    const line = await sendLineBroadcast(message);
    if (!line.ok) {
      await markFailed(jst.date, `LINE ${line.status}: ${line.text}`);
      return NextResponse.json({
        success: false,
        error: "LINE delivery failed",
        status: line.status,
        response: line.text,
      }, { status: 502 });
    }

    await saveCandidates(jst.date, top3);
    await markSent(jst.date);

    return NextResponse.json({
      success: true,
      route: ROUTE,
      date: jst.date,
      jstTime: jst.time,
      counts,
      top3: top3.map((stock) => ({
        code: stock.code,
        name: stock.name,
        aiPower: scoreOf(stock),
        price: stock.price,
      })),
      previousCandidateCount: previousResults.length,
      lineStatus: line.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(jst.date, message).catch(() => undefined);
    console.error("[evening-report]", error);
    return NextResponse.json({
      success: false,
      error: "evening report failed",
      message,
    }, { status: 500 });
  }
}
