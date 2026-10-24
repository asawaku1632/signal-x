import { timingSafeEqual } from "node:crypto";

export function verifyResearchSchedulerToken(authorization: string, secret: string | undefined): "NOT_CONFIGURED" | "AUTHORIZED" | "UNAUTHORIZED" {
  if (!secret || secret.length < 32) return "NOT_CONFIGURED";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "AUTHORIZED" : "UNAUTHORIZED";
}
