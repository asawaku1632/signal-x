import test from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier.startsWith("@/")){
  const path=specifier.slice(2)+(/\.[cm]?[jt]s$/.test(specifier)?"":".ts");
  return nextResolve(new URL("../../"+path,import.meta.url).href,context);
 }
 return nextResolve(specifier,context);
}});
const {evaluateFreshBuyWithStructures}=await import("../../app/lib/freshStructureBuy.ts");
const date="2026-11-09",start=Date.parse(date+"T09:00:00+09:00")/1000;
function seed(){return Array.from({length:42},(_,i)=>({time:start+i*300,open:100,high:100.2,low:99.8,close:100,volume:100}));}
function put(b,i,close,high=close+.1,low=close-.1,open=close){b[i]={...b[i],open,high,low,close};}
function fixture(kind){
 const b=seed();
 if(kind==="box"){for(let i=21;i<41;i++)put(b,i,100,102,98);put(b,41,102.7,102.8,102.4,102.5);}
 if(kind==="flag"||kind==="pennant"){
  for(let j=0;j<12;j++)put(b,19+j,100+j*(kind==="flag"?.65:.72));
  for(let j=0;j<10;j++){
   if(kind==="flag")put(b,31+j,106-j*.1,107-j*.1,105-j*.1);
   else put(b,31+j,105.5,108-j/6,103+j/6);
  }
  put(b,41,107.2,107.3,106.8,106.9);
 }
 if(kind==="triangle"){
  for(let j=0;j<29;j++)put(b,12+j,101.85,102,99+j*.1);
  put(b,41,103,103.1,102.5,102.8);
 }
 if(kind==="inverse"){
  const lows=[...Array.from({length:20},(_,i)=>100.2+i*.01),99,100,101,100.8,100.6,99.9,99,98,96,98,99,100,101,100.5,100,99.5,99,100,100.4,100.8,101];
  for(let i=0;i<41;i++)put(b,i,101.5,102.1,lows[i]);
  put(b,41,102.6,102.7,102.3,102.4);
 }
 b[41].volume=200;return b;
}
const expected={box:"ボックス上抜け",flag:"フラッグブレイク",pennant:"ペナント上抜け",triangle:"上昇三角持ち合い",inverse:"逆三尊"};
for(const [kind,name] of Object.entries(expected)){
 test(kind+" newly confirms with frozen geometry",()=>{
  const b=fixture(kind),now=(b.at(-1).time+300)*1000,r=evaluateFreshBuyWithStructures(b,now,date);
  const signal=r.signals?.find(s=>s.engineName===name);
  assert.ok(signal,JSON.stringify(r.signals));assert.ok(signal.level>0);assert.ok(signal.points.length>0);
  assert.equal(r.barTime,b[41].time);assert.equal(r.price,b[41].close);
 });
 test(kind+" cannot use future or unfinished breakout",()=>{
  const b=fixture(kind),now=(b.at(-1).time+300)*1000;
  const r=evaluateFreshBuyWithStructures(b,now-1,date);
  assert.ok(!r.signals?.some(s=>s.engineName===name));
  const original=evaluateFreshBuyWithStructures(b,now,date);
  assert.deepEqual(evaluateFreshBuyWithStructures([...b,{...b[41],time:now/1000+300,close:99999}],now,date),original);
 });
}
test("old confirmed pattern does not repeat on continuation",()=>{
 const b=fixture("inverse"),now=(b.at(-1).time+600)*1000;
 b.push({...b.at(-1),time:b.at(-1).time+300,open:102.6,low:102.5,high:102.9,close:102.8,volume:200});
 assert.ok(!evaluateFreshBuyWithStructures(b,now,date).signals?.some(s=>s.engineName==="逆三尊"));
});
test("thin volume does not authorize structural notifications",()=>{
 const b=fixture("inverse");b[41].volume=10;
 assert.ok(!evaluateFreshBuyWithStructures(b,(b[41].time+300)*1000,date).signals?.some(s=>s.engineName));
});
