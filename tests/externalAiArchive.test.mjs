import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateExternalArchive,wasArchivedBeforeOpen} from "../app/lib/research/externalAiArchive.mjs";

const fixed=new Date("2026-10-14T07:58:00+09:00");
const input={
  tradeDate:"2026-10-14",code:"285A",providerName:"オニオンサーモン",
  stockName:"キオクシアHD",buyLimit:"13662",originalPostUrl:"",
  publishedAtJst:"",sourceNote:"Screenshots only. Original time unverified."
};
const valid=(values={},now=fixed)=>validateExternalArchive({...input,...values},now);

test("285A is accepted and an old screenshot is NOT certified",()=>{
  const result=valid();
  assert.equal(result.ok,true);
  assert.equal(result.value.code,"285A");
  assert.equal(result.value.originalPostUrl,null);
  assert.equal(result.value.claimedPublishedAt,null);
  assert.equal("publicationVerified" in result.value,false);
});

test("traditional four-digit JPX stock code is accepted",()=>{
  const result=valid({code:"1925",buyLimit:"2038"});
  assert.equal(result.ok,true);
  assert.equal(result.value.buyLimit,2038);
});

test("malformed dates and fabricated code or price are rejected",()=>{
  for(const values of [
    {tradeDate:"2026-02-30"},{tradeDate:"1980-10-14"},
    {tradeDate:"2028-10-14"},{code:"abc4"},{code:"285Zx"},
    {buyLimit:"-100"},{buyLimit:"1e7"},{buyLimit:"0"},
    {buyLimit:"1.0001"},{buyLimit:"999999999"}
  ]) assert.equal(valid(values).ok,false,JSON.stringify(values));
});

test("only https sources without credentials, valid hostnames are accepted",()=>{
  assert.equal(valid({originalPostUrl:"https://x.com/someuser/status/123"}).ok,true);
  for(const url of ["http://x.com/status/123","https://localhost/private",
    "https://user:pass@x.com/post","javascript:alert(1)"]) {
    assert.equal(valid({originalPostUrl:url}).ok,false,url);
  }
});

test("claimed timestamps are labelled claims and cannot be later than server receipt",()=>{
  const result=valid({publishedAtJst:"2026-10-14T07:55"});
  assert.equal(result.ok,true);
  assert.equal(result.value.claimedPublishedAt,"2026-10-13T22:55:00.000Z");
  assert.equal(valid({publishedAtJst:"2026-10-14T08:00"}).ok,false);
  assert.equal(valid({publishedAtJst:"2026-10-14T30:00"}).ok,false);
  assert.equal(valid({publishedAtJst:"2026-02-30T08:00"}).ok,false);
});

test("server receipt (not screenshot's post time) governs pre-open badge",()=>{
  assert.equal(wasArchivedBeforeOpen("2026-10-14","2026-10-14T08:59:59+09:00"),true);
  assert.equal(wasArchivedBeforeOpen("2026-10-14","2026-10-14T09:00:00+09:00"),false);
  assert.equal(wasArchivedBeforeOpen("2026-10-14","2026-10-14T16:51:00+09:00"),false);
  assert.equal(wasArchivedBeforeOpen("2026-02-30","2026-10-14T00:00:00Z"),false);
  assert.equal(wasArchivedBeforeOpen("2026-10-14","invalid"),false);
});

test("notes and provider lengths have fixed bounds",()=>{
  assert.equal(valid({sourceNote:"a".repeat(401)}).ok,false);
  assert.equal(valid({providerName:"p".repeat(61)}).ok,false);
  assert.equal(valid({stockName:""}).ok,false);
});

test("server write route and owner archive stay separate from AI and scans",()=>{
  const action=readFileSync(new URL("../app/admin/external-ai-audit/actions.ts",import.meta.url),"utf8");
  assert.match(action,/getLearningOwnerSession/);
  assert.match(action,/if \(!isOwner\) notFound/);
  assert.match(action,/INSERT INTO public\.external_ai_forecast_archive/);
  assert.doesNotMatch(action,/\bUPDATE\b|\bDELETE\b|daily_stock_results|send(Line|Notification)|scanStocks/);
});

test("migration is isolated, RLS and mutation blocker present",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/20261014_create_external_ai_forecast_archive.sql",import.meta.url),"utf8");
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.external_ai_forecast_archive FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/BEFORE UPDATE OR DELETE/);
  assert.doesNotMatch(sql,/\bDROP TABLE\b|TRUNCATE|daily_stock_results|paper_trades|notification_queue/);
});
