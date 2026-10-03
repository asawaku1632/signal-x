import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function secretsMatch(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function requireCronAuth(request: Request) {
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.NOTIFICATION_RUNNER_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (allowedSecrets.length === 0) {
    return NextResponse.json(
      { success: false, error: "Cron authentication is not configured" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  const authorized =
    Boolean(suppliedSecret) &&
    allowedSecrets.some((secret) => secretsMatch(secret, suppliedSecret));

  if (!authorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return null;
}
