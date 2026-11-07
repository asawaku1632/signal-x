import test from "node:test";
import assert from "node:assert/strict";
import {shapeConditionMarks,shapeDirectionGuide} from "../../app/lib/research/shapeReferenceMarks.mjs";
const bars=Array.from({length:12},(_,i)=>({time:100+i,close:[1,1,1,1,2,2,1,1,2,2,2,1][i]}));
test("marks the most recent confirmation run, not every candle",()=>{
 const r=shapeConditionMarks(bars,x=>x.at(-1).close===2);
 assert.deepEqual(r.marks.map(m=>m.index),[8,10]);assert.equal(r.active,false);
});
test("current run has final confirmation mark",()=>{
 const r=shapeConditionMarks(bars.slice(0,11),x=>x.at(-1).close===2);
 assert.equal(r.active,true);assert.equal(r.marks[1].label,"② 判定足");
});
test("single matching candle has one marker",()=>{assert.equal(shapeConditionMarks(bars.slice(0,9),x=>x.at(-1).close===2).marks.length,1);});
test("never passes future bars into a historical decision",()=>{
 let lastLength=4;shapeConditionMarks(bars,prefix=>{assert.equal(prefix.length,lastLength+1);assert.equal(prefix.at(-1).time,100+lastLength);lastLength++;return false;});
 assert.equal(lastLength,12);
});
test("no condition match creates no fake origin",()=>{assert.deepEqual(shapeConditionMarks(bars,()=>false).marks,[]);});
test("short history does not claim a condition origin",()=>{assert.equal(shapeConditionMarks(bars.slice(0,4),()=>true).marks.length,0);});
test("classification is directional, neutral remains wait",()=>{
 assert.equal(shapeDirectionGuide("BUY").short,"買い目線");assert.equal(shapeDirectionGuide("SELL").short,"売り警戒");assert.equal(shapeDirectionGuide("NEUTRAL").short,"方向待ち");
});
