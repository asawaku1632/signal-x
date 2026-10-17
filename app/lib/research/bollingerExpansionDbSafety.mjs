// Pure fail-closed preflight. No network access or database queries.
const PRODUCTION_PROJECT_REF = "paygtakajhvatwejygda";
export function checkBbExpansionDbSafety(env = {}) {
  if (env.BB_EXPANSION_WRITE_ENABLED !== "true") return {ok:false,reason:"WRITE_DISABLED"};
  if (env.VERCEL_ENV === "production") return {ok:false,reason:"PRODUCTION_RUNTIME_REJECTED"};
  const expected = env.BB_EXPANSION_RESEARCH_PROJECT_REF;
  const forbidden = PRODUCTION_PROJECT_REF;
  if (typeof expected !== "string" || !/^[a-z0-9]{12,32}$/.test(expected) || expected === forbidden) return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  let url;
  try { url = new URL(env.BB_EXPANSION_RESEARCH_DATABASE_URL); } catch { return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"}; }
  if (!["postgres:","postgresql:"].includes(url.protocol) || !url.username || !url.password) return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  const identity = url.hostname + ":" + decodeURIComponent(url.username);
  if (identity.includes(forbidden)) return {ok:false,reason:"PRODUCTION_DB_REJECTED"};
  if (!identity.includes(expected)) return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  return {ok:true,reason:"PREFLIGHT_OK"};
}
