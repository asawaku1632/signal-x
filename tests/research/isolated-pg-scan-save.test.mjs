import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { saveResearchScanCaptureDev } from "../../app/lib/learning/saveResearchScanCaptureDev.mjs";

test("isolated PostgreSQL: real save, idempotency and rollback", async (t) => {
  if (process.env.SIGNALX_RESEARCH_ISOLATED_PG !== "true") {
    t.skip("isolated PostgreSQL is opt-in");
    return;
  }
  const client = new pg.Client({
    host: "127.0.0.1", port: 5432, database: "signalx_research_ci",
    user: "signalx_ci", password: process.env.SIGNALX_RESEARCH_CI_PASSWORD,
    ssl: false,
  });
  await client.connect();
  const original = process.env.SIGNALX_RESEARCH_DEV_WRITE;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TABLE public.research_scan_feature_captures (
      capture_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      scan_run_id text NOT NULL, trade_date date NOT NULL, code text NOT NULL,
      scan_received_at timestamptz NOT NULL, source_bar_at timestamptz,
      source_name text, feature_version text NOT NULL,
      ai_power numeric, entry_price numeric,
      rsi_band text, trend_key text, ema20_key text, vwap_key text,
      macd_key text, pattern_key text,
      capture_status text NOT NULL, audit_reason text NOT NULL,
      UNIQUE(scan_run_id,code),
      CHECK (capture_status IN ('QUARANTINED','ASOF_CANDIDATE')),
      CHECK (source_bar_at IS NULL OR source_bar_at <= scan_received_at)
    )`);
    process.env.SIGNALX_RESEARCH_DEV_WRITE = "true";
    const input = {
      scanRunId: "ci-isolated-run", tradeDate: "2026-10-28",
      scanReceivedAt: "2026-10-28T06:35:00Z",
      scanResponse: { cached:false, stocks:[
        { code:"590A",price:1000,aiPower:75,
          latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000 }
      ]}
    };
    const first = await saveResearchScanCaptureDev(client,input);
    const second = await saveResearchScanCaptureDev(client,input);
    assert.equal(first.inserted,1);
    assert.equal(second.inserted,0);
    assert.equal(second.duplicates,1);
    const actual = await client.query("SELECT code,capture_status,audit_reason FROM public.research_scan_feature_captures");
    assert.equal(actual.rowCount,1);
    assert.equal(actual.rows[0].code,"590A");
    assert.equal(actual.rows[0].capture_status,"QUARANTINED");
    assert.equal(actual.rows[0].audit_reason,"UNVERIFIED_FEATURE_ASOF_AND_PROVIDER");
    const missing = await saveResearchScanCaptureDev(client,{
      ...input,scanRunId:"ci-missing-bar",
      scanResponse:{cached:false,stocks:[{code:"641A",price:1200,aiPower:40,latestBarTimestamp:null}]}
    });
    assert.equal(missing.inserted,1);
    const missingRows=await client.query("SELECT capture_status,audit_reason FROM public.research_scan_feature_captures WHERE scan_run_id=$1",["ci-missing-bar"]);
    assert.equal(missingRows.rows[0].capture_status,"QUARANTINED");
    assert.equal(missingRows.rows[0].audit_reason,"MISSING_OR_INVALID_TIMESTAMP");
  } finally {
    try {
      await client.query("ROLLBACK");
      const after=await client.query("SELECT to_regclass('public.research_scan_feature_captures') AS table_name");
      assert.equal(after.rows[0].table_name,null);
    } finally {
      await client.end();
    }
    if (original === undefined) delete process.env.SIGNALX_RESEARCH_DEV_WRITE;
    else process.env.SIGNALX_RESEARCH_DEV_WRITE = original;
  }
});

test("isolated CI mode still refuses production host", async () => {
  const oldEnv=process.env.SIGNALX_RESEARCH_DEV_WRITE;
  const oldCi=process.env.SIGNALX_RESEARCH_ISOLATED_PG;
  const oldNode=process.env.NODE_ENV;
  try {
    process.env.SIGNALX_RESEARCH_DEV_WRITE="true";
    process.env.SIGNALX_RESEARCH_ISOLATED_PG="true";
    process.env.NODE_ENV="test";
    let writes=0;
    const client={
      connectionParameters:{host:"db.paygtakajhvatwejygda.supabase.co",database:"postgres",user:"postgres"},
      query:async()=>{writes++;return {rowCount:1};}
    };
    await assert.rejects(saveResearchScanCaptureDev(client,{
      scanRunId:"ci-no-prod",tradeDate:"2026-10-28",scanReceivedAt:"2026-10-28T06:35:00Z",
      scanResponse:{stocks:[{code:"590A",price:1000,aiPower:75,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000}]}
    }),/RESEARCH_DEV_DATABASE_NOT_VERIFIED/);
    assert.equal(writes,0);
  } finally {
    if(oldEnv===undefined)delete process.env.SIGNALX_RESEARCH_DEV_WRITE;else process.env.SIGNALX_RESEARCH_DEV_WRITE=oldEnv;
    if(oldCi===undefined)delete process.env.SIGNALX_RESEARCH_ISOLATED_PG;else process.env.SIGNALX_RESEARCH_ISOLATED_PG=oldCi;
    if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
  }
});
