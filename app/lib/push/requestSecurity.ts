import { NextResponse } from "next/server";

const MAX_REQUEST_BYTES = 16 * 1024;
const REQUIRED_REQUEST_HEADER = "push-ui";

function allowedOrigins(request: Request) {
  const origins = new Set<string>();
  const configuredOrigin = process.env.NEXTAUTH_URL;
  if (configuredOrigin) {
    try {
      origins.add(new URL(configuredOrigin).origin);
    } catch {
      // Invalid server configuration is handled as a denied origin.
    }
  }

  if (process.env.NODE_ENV !== "production" || origins.size === 0) {
    origins.add(new URL(request.url).origin);
  }

  return origins;
}

export function requireSecurePushRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (!host || host !== requestUrl.host) {
    return NextResponse.json({ success: false, error: "Invalid request host" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ success: false, error: "Unsupported content type" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ success: false, error: "Request body is too large" }, { status: 413 });
  }

  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(request).has(origin)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ success: false, error: "Cross-site request denied" }, { status: 403 });
  }

  if (request.headers.get("x-signalx-request") !== REQUIRED_REQUEST_HEADER) {
    return NextResponse.json({ success: false, error: "Invalid request header" }, { status: 403 });
  }

  return null;
}

export async function readLimitedJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  return JSON.parse(text);
}
