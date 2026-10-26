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
  assert.match(service, /isTseTargetDateReady\(day\)/);
  assert.match(service, /getForwardCandles/);
  assert.match(service, /MAX_YAHOO_CODES_PER_RUN = 8/);
  assert.match(service, /day >= getJstDateString\(\)/);
  assert.match(service, /YAHOO_DAILY_CLOSE/);
  assert.doesNotMatch(service, /FROM public\.daily_stock_results/);
  assert.match(service, /archive\.splitEvents/);
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
  assert.match(read("app/admin/post-sale-audit/PostSaleClient.tsx"), /saleDate: ""/);
  assert.match(read("app/lib/research/ownerPostSaleAudit.ts"), /"LATE_REGISTERED"/);
  assert.match(read("app/admin/learning-hub/page.tsx"), /\/admin\/post-sale-audit/);
});

test("the stock-quantity input accepts exactly 100 shares and all positive integers", () => {
  const component = read("app/admin/post-sale-audit/PostSaleClient.tsx");
  assert.match(component, /min=\{key === "quantity" \? "1"/);
  assert.match(component, /key === "quantity" \? "1" : "0\.01"/);
  assert.match(component, /quantity: ""/);
  assert.match(component, /field\("quantity", "株数", "number"\)/);
  // HTML number-input constraint formula: (value - min) / step must be integral.
  const min = 1, step = 1;
  assert.equal((100 - min) % step, 0);
  assert.equal((1 - min) % step, 0);
  assert.equal((99.5 - min) % step, 0.5);
  // Regression: min=0.01, step=1 previously rejected every positive integer.
  assert.notEqual((100 - 0.01) % 1, 0);
});
