import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EMA_RESEARCH_UNIVERSE, EMA_VALIDATION_EPOCH, inPhase, metric,
  gapAnomalies, studyEmaStock, regimeAtBuySignal, summarizeEmaResearch,
} from "../app/lib/emaRegimeResearch.ts";

const candles = (prices) => prices.map((close,i)=>({
  time: Date.parse("2024-10-01T00:00:00Z")/1000 + i*86400,
  open: close, high:close+2, low:close-2, close, volume:1000,
}));
const sample = () => candles([
  ...Array(100).fill(100),
  ...Array.from({length:40},(_,i)=>101+3*i),
  ...Array.from({length:40},(_,i)=>220-4*i),
]);
const makeTrade=(entryTime,exitTime,pnlYen=100)=>({
  buySignalTime:entryTime-86400,entryTime,sellSignalTime:exitTime-86400,exitTime,
  entryPrice:100,exitPrice:101,shares:100,pnlYen,returnPercent:pnlYen/100,holdBars:2,
});

test("preset stock list is deterministic and distinct for 20/40",()=>{
  assert.equal(EMA_RESEARCH_UNIVERSE.length,40);
  assert.equal(new Set(EMA_RESEARCH_UNIVERSE.map(x=>x.code)).size,40);
  assert.ok(EMA_RESEARCH_UNIVERSE.every(x=>/^\d{4}$/.test(x.code)));
});

test("train/test cut excludes cross-boundary trades and cannot double count",()=>{
  const d=86400;
  const before=makeTrade(EMA_VALIDATION_EPOCH-10*d, EMA_VALIDATION_EPOCH-d);
  const cross=makeTrade(EMA_VALIDATION_EPOCH-2*d, EMA_VALIDATION_EPOCH+d);
  const after=makeTrade(EMA_VALIDATION_EPOCH+d, EMA_VALIDATION_EPOCH+12*d);
  assert.deepEqual([before,cross,after].filter(t=>inPhase(t,"TRAIN")),[before]);
  assert.deepEqual([before,cross,after].filter(t=>inPhase(t,"TEST")),[after]);
  assert.equal([before,cross,after].filter(t=>inPhase(t,"ALL")).length,3);
});

test("regime classification only uses bars through signal date",()=>{
  const c=candles([...Array(100).fill(100),...Array.from({length:40},(_,i)=>101+i)]);
  const original=regimeAtBuySignal(c,125);
  assert.equal(original.trend,"UP");
  c.splice(126,14,...candles(Array(14).fill(100000)));
  assert.deepEqual(regimeAtBuySignal(c,125),original);
  assert.equal(regimeAtBuySignal(c,3).trend,"UNKNOWN");
});

test("high volatility is classified from past twenty changes, not forward candles",()=>{
  const c=candles([...Array(100).fill(100), ...Array.from({length:20},(_,i)=>i%2===0?130:80), ...Array(10).fill(300)]);
  assert.equal(regimeAtBuySignal(c,119).volatility,"HIGH");
  assert.equal(regimeAtBuySignal(c,99).volatility,"LOW");
});

test("split event or extreme overnight gap quarantines stock from aggregate",()=>{
  const bars=sample();
  assert.equal(studyEmaStock({code:"7203",candles:bars}).reason,null);
  assert.ok(studyEmaStock({code:"7203",candles:bars,splitEvents:[bars[90].time]}).reason?.includes("株式分割"));
  assert.equal(gapAnomalies(bars),0);
  const shocked=bars.map(x=>({...x}));
  shocked[100].open*=0.5;
  assert.ok(gapAnomalies(shocked)>0);
  assert.ok(studyEmaStock({code:"7203",candles:shocked}).reason?.includes("ギャップ"));
  const summary=summarizeEmaResearch([
    {code:"7203",candles:bars},
    {code:"9984",candles:shocked},
  ]);
  assert.equal(summary.eligibleCount,1);
  assert.equal(summary.excludedCount,1);
  assert.equal(summary.stocks[1].trades.BASE.length,0);
});

test("empty metrics show no win-rate, not fabricated perfect score",()=>{
  const empty=metric([]);
  assert.equal(empty.trades,0);
  assert.equal(empty.winRatePercent,null);
  assert.equal(empty.averageReturnPercent,null);
  assert.equal(empty.pnlYen,0);
  const all=metric([makeTrade(1,4,100),makeTrade(2,5,-200)]);
  assert.equal(all.wins,1);
  assert.equal(all.losses,1);
  assert.equal(all.winRatePercent,50);
  assert.equal(all.pnlYen,-100);
});

test("new page and data access remain admin-only, read-only, no cron notification or DB writes",()=>{
  const page=readFileSync("app/admin/ema-regimes/page.tsx","utf8");
  const ui=readFileSync("app/admin/ema-regimes/EmaRegimeClient.tsx","utf8");
  const lib=readFileSync("app/lib/emaRegimeResearch.ts","utf8");
  const api=readFileSync("app/api/admin/ema-signals/route.ts","utf8");
  assert.match(page,/getAdminSession/);
  assert.match(page,/if \(!isAdmin\)/);
  assert.match(api,/if \(!isAdmin\)/);
  assert.match(api,/events=splits/);
  assert.match(ui,/range=2y/);
  assert.match(ui,/研究を開始・再実行/);
  assert.doesNotMatch(ui+lib+api,/pool\.query|INSERT INTO|UPDATE public|DELETE FROM|sendNotification|sendLine|saveDisplaySnapshot/i);
});
