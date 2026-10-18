import test from "node:test";
import assert from "node:assert/strict";
import {attachResearchTwaWebReceiver as attach} from "../app/lib/billing/twaWebPortReceiverResearch.ts";
import {TWA_PLAY_ORIGIN,TWA_PLAY_PROTOCOL} from "../app/lib/billing/twaPostMessageBridgeResearch.ts";
const N="A".repeat(22),T="B".repeat(43),BASE=Date.parse("2026-10-18T02:00:00Z");
function browser(origin=TWA_PLAY_ORIGIN){
  const callbacks=new Map([["message",new Set()],["pagehide",new Set()]]);
  return {location:{origin},callbacks,
    addEventListener(type,cb){callbacks.get(type).add(cb)},
    removeEventListener(type,cb){callbacks.get(type).delete(cb)},
    emit(type,e){for(const cb of callbacks.get(type))cb(e)}
  };
}
function port(){
  const sent=[];
  let closed=false;
  return {sent,onmessage:null,start(){},close(){closed=true},get closed(){return closed},
    postMessage(v){sent.push(v)},
    inbound(msg){this.onmessage?.({data:JSON.stringify(msg)})}
  };
}
const hello=(p,override={})=>({
  origin:TWA_PLAY_ORIGIN,
  source:null,
  data:JSON.stringify({type:TWA_PLAY_PROTOCOL+"/hello",nonce:N}),
  ports:[p],...override
});
test("disabled receiver installs no listener and cannot transmit",()=>{
  const w=browser(),r=attach(w,false),p=port();
  w.emit("message",hello(p));
  assert.equal(r.isReady(),false);
  assert.equal(r.sendTicket(T,BASE+10_000,new Date(BASE)),false);
  assert.equal(w.callbacks.get("message").size,0);
});
test("trusted origin HELLO yields ack, READY unlocks and ticket transfers once",()=>{
  const w=browser(),r=attach(w,true),p=port();
  w.emit("message",hello(p));
  assert.deepEqual(p.sent.map(JSON.parse),[{type:TWA_PLAY_PROTOCOL+"/hello-ack",nonce:N}]);
  assert.equal(r.isReady(),false);
  assert.equal(r.sendTicket(T,BASE+1000,new Date(BASE)),false);
  p.inbound({type:TWA_PLAY_PROTOCOL+"/ready",nonce:N});
  assert.equal(r.isReady(),true);
  assert.equal(r.sendTicket(T,BASE+1000,new Date(BASE)),true);
  assert.deepEqual(JSON.parse(p.sent[1]),{
    type:TWA_PLAY_PROTOCOL+"/checkout-ticket",nonce:N,
    ticket:T,expiresAtMillis:BASE+1000
  });
  assert.equal(r.sendTicket(T,BASE+1000,new Date(BASE)),false);
  r.dispose();
  assert.equal(w.callbacks.get("message").size,0);
});
test("cross-origin and WindowProxy-like messages cannot establish a native port",()=>{
  const w=browser(),r=attach(w,true),p=port();
  w.emit("message",hello(p,{origin:"https://evil.example"}));
  w.emit("message",hello(p,{source:{window:"iframe"}}));
  assert.equal(p.sent.length,0);
  assert.equal(r.isReady(),false);
  r.dispose();
});
test("wrong or malformed READY destroys channel, later stale port cannot transfer",()=>{
  const w=browser(),r=attach(w,true),p=port();
  w.emit("message",hello(p));
  p.inbound({type:TWA_PLAY_PROTOCOL+"/ready",nonce:"C".repeat(22)});
  assert.equal(p.closed,true);
  assert.equal(r.isReady(),false);
  assert.equal(r.sendTicket(T,BASE+1000,new Date(BASE)),false);
  const p2=port();
  w.emit("message",hello(p2));
  p2.inbound({type:TWA_PLAY_PROTOCOL+"/ready",nonce:N});
  assert.equal(r.isReady(),true);
  w.emit("pagehide",{});
  assert.equal(r.isReady(),false);
  assert.equal(p2.closed,true);
});
test("new channel closes old and rejects stale channel replies",()=>{
  const w=browser(),r=attach(w,true),p1=port(),p2=port();
  w.emit("message",hello(p1));
  w.emit("message",hello(p2));
  assert.equal(p1.closed,true);
  p1.inbound({type:TWA_PLAY_PROTOCOL+"/ready",nonce:N});
  assert.equal(r.isReady(),false);
  p2.inbound({type:TWA_PLAY_PROTOCOL+"/ready",nonce:N});
  assert.equal(r.isReady(),true);
  r.dispose();
  assert.equal(r.isReady(),false);
  assert.equal(p2.closed,true);
});
