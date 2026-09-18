import crypto from "crypto";
import { NextResponse } from "next/server";
import { consumeLineLinkToken } from "@/app/lib/line/linking";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

function validSignature(body: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function reply(replyToken: string, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ success: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(body) as { events?: LineEvent[] };
  } catch {
    return NextResponse.json({ success: false, error: "invalid json" }, { status: 400 });
  }

  for (const event of payload.events ?? []) {
    if (
      event.type !== "message" ||
      event.message?.type !== "text" ||
      !event.source?.userId ||
      !event.replyToken
    ) continue;

    const text = event.message.text?.trim() ?? "";
    const match = /^SIGNALX\s+LINK\s+([A-Za-z0-9_-]+)$/i.exec(text);
    if (!match) continue;

    const token = match[1];
    const linked = await consumeLineLinkToken(token, event.source.userId);
    await reply(
      event.replyToken,
      linked
        ? "✅ SIGNALXとのLINE連携が完了しました。お気に入り銘柄のAI買い条件成立・利確・損切をこのLINEへお知らせします。"
        : "⚠️ 連携コードが無効または期限切れです。SIGNALXから新しい連携コードを発行してください。",
    );
  }

  return NextResponse.json({ success: true });
}
