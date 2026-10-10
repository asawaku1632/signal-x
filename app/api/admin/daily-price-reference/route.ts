import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import {
  captureManualPriceReferences, getPriceReferenceObservations,
  jstToday, parseReferenceBatch,
} from "@/app/lib/learning/priceReferenceObservations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const privateHeaders = { "Cache-Control": "private, no-store" };
const forbidden = () => NextResponse.json({ success: false, error: "管理者権限が必要です" }, { status: 403, headers: privateHeaders });

// Read existing separately persisted prices; NEVER hits Yahoo or updates learning.
export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return forbidden();
  const url = new URL(request.url);
  try {
    const batch = parseReferenceBatch({
      date: url.searchParams.get("date"),
      codes: (url.searchParams.get("codes") ?? "").split(","),
    }, jstToday());
    return NextResponse.json({ success: true, observations: await getPriceReferenceObservations(batch.date, batch.codes) },
      { headers: privateHeaders });
  } catch {
    return NextResponse.json({ success: false, error: "銘柄・日付を確認してください" }, { status: 400, headers: privateHeaders });
  }
}

// Explicit admin action, bounded to five quotes. Writes ONLY the private research table.
export async function POST(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return forbidden();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: "同一サイトから操作してください" }, { status: 403, headers: privateHeaders });
  }
  let batch: ReturnType<typeof parseReferenceBatch>;
  const today = jstToday();
  try {
    batch = parseReferenceBatch(await request.json(), today);
  } catch {
    return NextResponse.json({ success: false, error: "銘柄は最大5件、日付は過去の東証取引日を指定してください" },
      { status: 400, headers: privateHeaders });
  }
  try {
    const capture = await captureManualPriceReferences(batch.date, batch.codes, today);
    return NextResponse.json({ success: true, date: batch.date, ...capture,
      note: "Yahoo日足は参考値です。取得後の訂正・株式分割などの可能性があります。当初の学習価格、勝敗、売買、通知は変更していません。" },
      { headers: privateHeaders });
  } catch (error) {
    console.error("[price-reference] manual audit failed", error);
    return NextResponse.json({ success: false, error: "参考株価の保存に失敗しました" },
      { status: 503, headers: privateHeaders });
  }
}
