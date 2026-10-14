import test from "node:test";
import assert from "node:assert/strict";
import {evaluateExternalLimitForecast as evaluate, summarizeExternalCohort, EXTERNAL_AI_AUDIT_VERSION} from "../app/lib/research/externalAiBenchmark.mjs";

const forecast = {
  code: "285A", tradeDate: "2026-10-14", buyLimit: 13662,
  publishedAt: "2026-10-14T08:40:00+09:00",
  originalPostUrl: "https://example.org/original/123", publicationVerified: true
};
const quote = {
  tradeDate: "2026-10-14", open: 14800, high: 15000, low: 14570,
  close: 14690, sessionComplete: true, verified: true,
  sameShareBasis: true, source: "historical-ohlc-audited"
};
const check=(f=forecast,q=quote)=>evaluate(f,q);

test("research version is isolated",()=>assert.equal(EXTERNAL_AI_AUDIT_VERSION,"EXTERNAL_AI_LIMIT_AUDIT_V1"));

test("Japanese alphanumeric codes, including 285A, supported; no imaginary fills",()=>{
  const r=check();
  assert.equal(r.status,"NOT_REACHED");
  assert.equal(r.grossPnl100,null);
  assert.equal(r.fillConfirmed,false);
});

test("a 16:51 screenshot does not verify an 08:40 original post",()=>{
  const r=check({...forecast,publicationVerified:false,publishedAt:"2026-10-14T16:51:00+09:00"});
  assert.equal(r.status,"REFERENCE_ONLY");
});

test("after-open predictions require intraday post-publication data, not daily low",()=>{
  assert.equal(check({...forecast,publishedAt:"2026-10-14T11:00:00+09:00"}).status,
    "AFTER_OPEN_NEEDS_INTRADAY");
});

test("unclosed or unsupported market snapshots cannot be judged as not filled",()=>{
  assert.equal(check(forecast,{...quote,sessionComplete:false}).status,"MARKET_DATA_UNVERIFIED");
  assert.equal(check(forecast,{...quote,verified:false}).status,"MARKET_DATA_UNVERIFIED");
  assert.equal(check(forecast,{...quote,tradeDate:"2026-10-13"}).status,"MARKET_DATA_UNVERIFIED");
});

test("split and price basis must be verified before pnl comparisons",()=>{
  assert.equal(check(forecast,{...quote,sameShareBasis:false}).status,"PRICE_BASIS_UNVERIFIED");
});

test("a touched limit is not an actual fill even with positive hypothetical pnl",()=>{
  const r=check({...forecast,code:"1925",buyLimit:2180},
    {...quote,open:2200,high:2220,low:2170,close:2190});
  assert.equal(r.status,"LIMIT_TOUCHED_UNCONFIRMED");
  assert.equal(r.grossPnl100,1000);
  assert.equal(r.fillConfirmed,false);
});

test("marketable limit at the open gets indicative open PnL, not limit-price PnL",()=>{
  const r=check({...forecast,code:"1925",buyLimit:2220},
    {...quote,open:2200,high:2230,low:2170,close:2190});
  assert.equal(r.status,"OPEN_MARKETABLE_INDICATIVE");
  assert.equal(r.indicativeEntry,2200);
  assert.equal(r.grossPnl100,-1000);
  assert.equal(r.fillConfirmed,false);
});

test("inconsistent OHLC and invalid predictions fail closed",()=>{
  assert.equal(check(forecast,{...quote,high:14000}).status,"MARKET_DATA_UNVERIFIED");
  assert.equal(check({...forecast,code:"a bad code"}).status,"INVALID_FORECAST");
  assert.equal(check({...forecast,tradeDate:"2026-02-30"}).status,"INVALID_FORECAST");
});

test("cohort denominators preserve non-fills and exclude uncertain touches from win-rate",()=>{
  const miss=check();
  const touched=check({...forecast,buyLimit:14700});
  const marketable=check({...forecast,buyLimit:14900});
  const report=summarizeExternalCohort([miss,touched,marketable,
    check({...forecast,publicationVerified:false})]);
  assert.equal(report.total,4);
  assert.equal(report.states.NOT_REACHED,1);
  assert.equal(report.states.LIMIT_TOUCHED_UNCONFIRMED,1);
  assert.equal(report.states.REFERENCE_ONLY,1);
  assert.equal(report.indicativeOpenCount,1);
  assert.equal(report.indicativeOpenWinRate,0);
  assert.equal(report.confirmedFills,0);
  assert.equal(report.sufficientEvidence,false);
});
