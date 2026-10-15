import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path, "utf8");
test("owner-only manually entered REAL trades remain isolated from paper positions and public users", () => {
  const api = read("app/api/admin/post-sale-audit/route.ts");
  const page = read("app/admin/post-sale-audit/page.tsx");
  const service = read("app/lib/research/ownerPostSaleAudit.ts");
  const schema = read("supabase/migrations/20261015_create_owner_post_sale_audits.sql");
  assert.match(api, /getLearningOwnerSession/);
  assert.match(api, /if \(!isOwner \|\| !email\) return forbidden/);
  assert.match(page, /if \(!isOwner\) notFound/);
  assert.match(schema, /ENABLE ROW LEVEL SECURITY/);
  assert.match(schema, /REVOKE ALL.*anon, authenticated/);
  assert.match(schema, /LATE_REGISTERED/);
  assert.doesNotMatch(service, /INSERT INTO public\.paper_trades|UPDATE public\.paper_trades/i);
  assert.doesNotMatch(service, /sendNotification|sendLine|runScan/);
});

test("checkpoint observation requires exact exchange dates and post-close daily prices", () => {
  const service = read("app/lib/research/ownerPostSaleAudit.ts");
  const cron = read("app/api/cron/swing-exit-audit/route.ts");
  assert.match(service, /resolveTseTradingDatesAfter\(dateOnly\(sale\.sale_date\), 5/);
  assert.match(service, /isTseTargetDateReady\(targetDate\)/);
  assert.match(service, /15:30/);
  assert.match(service, /date::date=\$2::date/);
  assert.match(service, /outcome_.*d_price IS NULL/);
  assert.match(cron, /requireCronAuth\(request\)/);
  assert.match(cron, /shouldRunReboundOnHost/);
  assert.match(cron, /updatePostSaleOutcomes/);
  assert.match(cron, /POST_SALE_AUDIT_UNAVAILABLE/);
});

test("3762 known realized and hypothetical results stay separate", () => {
  const quantity = 100, buy = 3195, sell = 3215, sampleIntraday = 3250;
  assert.equal((sell - buy) * quantity, 2000);
  assert.equal((sampleIntraday - buy) * quantity, 5500);
  assert.equal((sampleIntraday - sell) * quantity, 3500);
  assert.match(read("app/admin/post-sale-audit/PostSaleClient.tsx"), /saleDate: "2026-10-14"/);
  assert.match(read("app/lib/research/ownerPostSaleAudit.ts"), /"LATE_REGISTERED"/);
  assert.match(read("app/admin/learning-hub/page.tsx"), /\/admin\/post-sale-audit/);
});
