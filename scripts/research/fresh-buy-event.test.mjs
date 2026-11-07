import test from "node:test";
import assert from "node:assert/strict";
import {evaluateFreshBuy} from "../../app/lib/freshBuyEvent.mjs";
const date="2026-11-09";
function fixture(){const b=[];let t=Date.parse(date+"T09:00:00+09:00")/1000;for(let i=0;i<42;i++){const d=new Date((t+32400)*1000);if(d.getUTCHours()===11&&d.getUTCMinutes()===30)t+=3600;b.push({time:t,open:100,high:100.1,low:99.9,close:100,volume:100});t+=300;}return b;}
const now=b=>(b.at(-1).time+300)*1000;
const set=(b,i,c,v=100)=>b[i]={...b[i],open:c,high:c+.1,low:c-.1,close:c,volume:v};
test("fresh high captures exact price and confirmed time",()=>{const b=fixture();set(b,41,101,200);const r=evaluateFreshBuy(b,now(b),date);assert.ok(r.signals.some(s=>s.kind==="HIGH_BREAKOUT"));assert.equal(r.price,101);assert.equal(r.barTime,b[41].time);assert.equal(r.candles.length,42);});
test("continued breakout is not a fresh high event",()=>{const b=fixture();set(b,40,101,200);set(b,41,102,200);assert.ok(!evaluateFreshBuy(b,now(b),date).signals.some(s=>s.kind==="HIGH_BREAKOUT"));});
test("pullback must recover the three-bar high",()=>{const b=fixture();for(let i=30;i<38;i++)set(b,i,i===30?101:103);set(b,38,102.5);set(b,39,102);set(b,40,101.5);set(b,41,103,150);assert.ok(evaluateFreshBuy(b,now(b),date).signals.some(s=>s.kind==="PULLBACK_REBOUND"));set(b,41,102,150);assert.ok(!evaluateFreshBuy(b,now(b),date).signals.some(s=>s.kind==="PULLBACK_REBOUND"));});
test("BB compression must expand upwards",()=>{const b=fixture();for(let i=0;i<41;i++)set(b,i,100+(i%2?1:-1)*(i<21?1:.05));set(b,41,101,200);assert.ok(evaluateFreshBuy(b,now(b),date).signals.some(s=>s.kind==="BB_UP_EXPANSION"));set(b,41,99,200);assert.equal(evaluateFreshBuy(b,now(b),date).matched,false);});
test("flat and thin volume do not trigger",()=>{const b=fixture();assert.equal(evaluateFreshBuy(b,now(b),date).matched,false);set(b,41,101,10);assert.equal(evaluateFreshBuy(b,now(b),date).matched,false);});
test("stale duplicate invalid inputs rejected",()=>{const b=fixture();set(b,41,101,200);assert.equal(evaluateFreshBuy(b,now(b)+21*60000,date).reason,"STALE_BARS");assert.equal(evaluateFreshBuy([...b,b[0]],now(b),date).reason,"DUPLICATE_BARS");b[41].volume=NaN;assert.equal(evaluateFreshBuy(b,now(b),date).reason,"INVALID_OHLCV");});
test("unfinished and future data cannot change an event",()=>{const b=fixture();set(b,41,101,200);const t=now(b);assert.deepEqual(evaluateFreshBuy([...b,{...b[41],time:t/1000+300,close:999999}],t,date),evaluateFreshBuy(b,t,date));assert.equal(evaluateFreshBuy(b,t-1,date).matched,false);});
test("one-bar overextension is held back",()=>{const b=fixture();set(b,41,110,200);assert.equal(evaluateFreshBuy(b,now(b),date).matched,false);});
test("wrong date and gaps are rejected",()=>{const b=fixture();assert.equal(evaluateFreshBuy(b,now(b),"2026-11-10").reason,"STALE_BARS");b[40].time-=100;assert.equal(evaluateFreshBuy(b,now(b),date).reason,"NONCONTIGUOUS_BARS");});
