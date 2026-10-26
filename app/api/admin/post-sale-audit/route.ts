import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getPostSaleReport, registerPostSale, type NewSale } from "@/app/lib/research/ownerPostSaleAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ success: false, error: "Owner access required" }, { status: 403 });

export async function GET() {
  const { isOwner, email } = await getLearningOwnerSession();
  if (!isOwner || !email) return forbidden();
  try {
    const data = await getPostSaleReport(email);
    return NextResponse.json({ success: true, ...data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[post-sale] report unavailable", e);
    return NextResponse.json({ success: false, error: "研究データの読み込みに失敗しました" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { isOwner, email } = await getLearningOwnerSession();
  if (!isOwner || !email) return forbidden();
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return forbidden(); }
    catch { return forbidden(); }
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const input: NewSale = {
      code: String(body.code ?? "").trim(),
      name: String(body.name ?? "").trim(),
      saleDate: String(body.saleDate ?? "").trim(),
      buyPrice: Number(body.buyPrice),
      salePrice: Number(body.salePrice),
      quantity: Number(body.quantity),
      executionNotes: {
        executedAtJst: typeof body.executedAtJst === "string" && body.executedAtJst ? body.executedAtJst : null,
        limitPrice: body.limitPrice === "" || body.limitPrice == null ? null : Number(body.limitPrice),
        reason: typeof body.saleReason === "string" && body.saleReason ? body.saleReason.trim() : null,
        unableToMonitor: body.unableToMonitor === true,
      },
    };
    const result = await registerPostSale(email, input);
    return NextResponse.json({ success: true, ...result },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "登録できませんでした";
    if (message.includes("確認してください") || message.includes("カレンダー") ||
        message.includes("取引日")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    console.error("[post-sale] registration failed", e);
    return NextResponse.json({ success: false, error: "登録できませんでした" }, { status: 503 });
  }
}
