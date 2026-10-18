// Fail-closed, offline preflight. This is NOT a live DB connectivity check.
const PRODUCTION_PROJECT_REF = "paygtakajhvatwejygda";
const RESEARCH_PROJECT_REF = "jdtqwryiyxeuoraecorw";
export function checkBbExpansionDbSafety(env = {}) {
  if (env.BB_EXPANSION_WRITE_ENABLED !== "true") return {ok:false,reason:"WRITE_DISABLED"};
  if (env.VERCEL_ENV !== "preview") return {ok:false,reason:"NON_PREVIEW_RUNTIME_REJECTED"};
  const expected = env.BB_EXPANSION_RESEARCH_PROJECT_REF;
  if (expected !== RESEARCH_PROJECT_REF) return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  let url;
  try { url = new URL(env.BB_EXPANSION_RESEARCH_DATABASE_URL); }
  catch { return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"}; }
  if (!["postgres:","postgresql:"].includes(url.protocol) || !url.username || !url.password || url.pathname !== "/postgres") return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  const host = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username);
  if (host.includes(PRODUCTION_PROJECT_REF) || username.includes(PRODUCTION_PROJECT_REF)) return {ok:false,reason:"PRODUCTION_DB_REJECTED"};
  const direct = host === "db."+RESEARCH_PROJECT_REF+".supabase.co" && username === "postgres";
  const pooler = (host.endsWith(".pooler.supabase.com") || host === "aws-0-ap-northeast-1.pooler.supabase.com") && username === "postgres."+RESEARCH_PROJECT_REF;
  if (!direct && !pooler) return {ok:false,reason:"RESEARCH_DB_UNCONFIRMED"};
  return {ok:true,reason:"PREFLIGHT_OK"};
}
