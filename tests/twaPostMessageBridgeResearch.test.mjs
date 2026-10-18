import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptTwaNativeHello, TWA_PLAY_ORIGIN, TWA_PLAY_PROTOCOL,
} from "../app/lib/billing/twaPostMessageBridgeResearch.ts";
const NONCE="Q".repeat(22),TICKET="T".repeat(43);
const BASE=Date.parse("2026-10-18T03:00:00.000Z");
function makePort(){
  const sent=[];
  let closed=false;
  return {sent,get closed(){return closed;},postMessage(v){sent.push(v);},close(){closed=true;}};
}
function hello(port,overrides={}){
  return {
    origin:TWA_PLAY_ORIGIN,
    ports:[port],
    data:{type:TWA_PLAY_PROTOCOL+"/hello",nonce:NONCE},
    ...overrides
  };
}
test("valid site-origin HELLO with transferred port returns challenge echo, but not ready",()=>{
  const port=makePort(),result=acceptTwaNativeHello(hello(port));
  assert.equal(result.kind,"accepted");
  assert.deepEqual(result.ack,{type:TWA_PLAY_PROTOCOL+"/hello-ack",nonce:NONCE});
  assert.equal(result.channel.ready,false);
  assert.equal(result.channel.sendTicket(TICKET,BASE+100_000,new Date(BASE)),false);
  assert.deepEqual(port.sent,[]);
});
test("wrong origin, extra ports, untrusted data and wrong source origin never create channel",()=>{
  const p=makePort();
  const candidates=[
    hello(p,{origin:"https://evil.example"}),
    hello(p,{origin:"http://signal-x-ppjg.vercel.app"}),
    hello(p,{ports:[]}),
    hello(p,{ports:[p,p]}),
    hello(p,{data:{type:TWA_PLAY_PROTOCOL+"/hello",nonce:"short"}}),
    hello(p,{data:{type:TWA_PLAY_PROTOCOL+"/hello",nonce:NONCE,ticket:TICKET}}),
    hello(p,{data:{type:TWA_PLAY_PROTOCOL+"/checkout-ticket",nonce:NONCE}}),
    hello(p,{data:"paid"}),
  ];
  for(const event of candidates)assert.equal(acceptTwaNativeHello(event).kind,"rejected");
  assert.equal(acceptTwaNativeHello(hello(p),"https://evil.example").kind,"rejected");
});
test("wrong, unsolicited or duplicate READY cannot unlock or reuse a channel",()=>{
  const port=makePort(),accepted=acceptTwaNativeHello(hello(port));
  assert.equal(accepted.kind,"accepted");
  const channel=accepted.channel;
  assert.equal(channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:"B".repeat(22)}),false);
  assert.equal(channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE,privileges:"premium"}),false);
  assert.equal(channel.ready,false);
  assert.equal(channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE}),true);
  assert.equal(channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE}),false);
  assert.equal(channel.ready,true);
});
test("one checkout ticket is transferred over the port once, without product or user input",()=>{
  const port=makePort(),accepted=acceptTwaNativeHello(hello(port));
  assert.equal(accepted.kind,"accepted");
  const channel=accepted.channel;
  assert.equal(channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE}),true);
  assert.equal(channel.sendTicket(TICKET,BASE+120_000,new Date(BASE)),true);
  assert.deepEqual(port.sent,[{
    type:TWA_PLAY_PROTOCOL+"/checkout-ticket",nonce:NONCE,ticket:TICKET,
    expiresAtMillis:BASE+120_000
  }]);
  assert.equal(channel.sendTicket(TICKET,BASE+120_000,new Date(BASE)),false);
  assert.equal(channel.ready,false);
});
test("expired, oversized TTL and malformed ticket cannot leave channel",()=>{
  const port=makePort(),accepted=acceptTwaNativeHello(hello(port));
  assert.equal(accepted.kind,"accepted");
  const channel=accepted.channel;
  channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE});
  assert.equal(channel.sendTicket(TICKET,BASE,new Date(BASE)),false);
  assert.equal(channel.sendTicket(TICKET,BASE+120_001,new Date(BASE)),false);
  assert.equal(channel.sendTicket("not a token",BASE+1_000,new Date(BASE)),false);
  assert.equal(channel.sendTicket(TICKET,Number.NaN,new Date(BASE)),false);
  assert.deepEqual(port.sent,[]);
  assert.equal(channel.sendTicket(TICKET,BASE+10_000,new Date(BASE)),true);
});
test("closed channel cannot send and port send failure never retries silently",()=>{
  const p=makePort(),a=acceptTwaNativeHello(hello(p));
  assert.equal(a.kind,"accepted");
  a.channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE});
  a.channel.close();
  assert.equal(p.closed,true);
  assert.equal(a.channel.sendTicket(TICKET,BASE+5_000,new Date(BASE)),false);
  const failing={postMessage(){throw Error("channel vanished");},close(){}};
  const b=acceptTwaNativeHello(hello(failing));
  assert.equal(b.kind,"accepted");
  b.channel.acceptReady({type:TWA_PLAY_PROTOCOL+"/ready",nonce:NONCE});
  assert.equal(b.channel.sendTicket(TICKET,BASE+5_000,new Date(BASE)),false);
  assert.equal(b.channel.sendTicket(TICKET,BASE+5_000,new Date(BASE)),false);
});
