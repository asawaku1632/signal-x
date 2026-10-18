import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeGooglePlayIntegrityToken as decode,
  createGooglePlayIntegrityDecoder,
} from "../app/lib/billing/googlePlayIntegrityDecoder.ts";
const TOKEN = "ci-encrypted-integrity-token";
const ACCESS = "ci-server-side-oauth";
const HASH = "a".repeat(43);
const payload = {
  tokenPayloadExternal: {
    requestDetails: {
      requestPackageName: "com.signalx.app",
      requestHash: HASH,
      timestampMillis: "1792288800000",
    },
    appIntegrity: {
      appRecognitionVerdict: "PLAY_RECOGNIZED",
      packageName: "com.signalx.app",
      certificateSha256Digest: ["test-play-signing-cert"],
    },
  },
};
test("sends opaque token to canonical Google Play Integrity API with bearer, never URL",async()=>{
  let calls=0;
  const result=await decode(TOKEN,ACCESS,async(url,init)=>{
    calls++;
    assert.equal(url,"https://playintegrity.googleapis.com/v1/com.signalx.app:decodeIntegrityToken");
    assert.equal(init.method,"POST");
    assert.equal(init.headers.Authorization,"Bearer "+ACCESS);
    assert.equal(init.headers["Content-Type"],"application/json");
    assert.equal(JSON.parse(init.body).integrityToken,TOKEN);
    assert.ok(!url.includes(TOKEN));
    assert.ok(!url.includes(ACCESS));
    return {ok:true,status:200,json:async()=>payload};
  });
  assert.equal(calls,1);
  assert.deepEqual(result,payload.tokenPayloadExternal);
});
test("derived server decoder uses the same guarded HTTP boundary",async()=>{
  const trusted=createGooglePlayIntegrityDecoder(ACCESS,async()=>({
    ok:true,status:200,json:async()=>payload,
  }));
  assert.deepEqual(await trusted(TOKEN),payload.tokenPayloadExternal);
});
test("invalid package, token and OAuth credentials never reach transport",async()=>{
  let called=0;
  const never=async()=>{called++;throw Error("must not be called")};
  assert.equal(await decode(TOKEN,ACCESS,never,"com.attacker.app"),null);
  assert.equal(await decode("",ACCESS,never),null);
  assert.equal(await decode("bad token",ACCESS,never),null);
  assert.equal(await decode(TOKEN,"",never),null);
  assert.equal(await decode(TOKEN,"with\r\ninjection",never),null);
  assert.equal(called,0);
});
test("Google rejects, network fails and JSON parsing fails closed",async()=>{
  for(const response of [
    {ok:false,status:403,json:async()=>payload},
    {ok:true,status:500,json:async()=>payload},
    {ok:true,status:200,json:async()=>{throw Error("bad JSON")}},
  ]) assert.equal(await decode(TOKEN,ACCESS,async()=>response),null);
  assert.equal(await decode(TOKEN,ACCESS,async()=>{throw Error("offline")}),null);
});
test("requires official tokenPayloadExternal wrapper, never client-supplied decoded JSON",async()=>{
  for(const value of [null,undefined,{},[],payload.tokenPayloadExternal,
                       {tokenPayloadExternal:"already-paid"},{tokenPayloadExternal:{}}]) {
    assert.equal(await decode(TOKEN,ACCESS,async()=>({
      ok:true,status:200,json:async()=>value,
    })),null);
  }
});
test("rejects missing or malformed attestation details rather than inventing defaults",async()=>{
  const cases=[
    {requestDetails:{...payload.tokenPayloadExternal.requestDetails,requestHash:"not-a-hash"}},
    {requestDetails:{...payload.tokenPayloadExternal.requestDetails,timestampMillis:1792288800000}},
    {requestDetails:{...payload.tokenPayloadExternal.requestDetails,timestampMillis:"0"}},
    {appIntegrity:{...payload.tokenPayloadExternal.appIntegrity,certificateSha256Digest:[]}},
    {appIntegrity:{...payload.tokenPayloadExternal.appIntegrity,certificateSha256Digest:["ok",123]}},
    {appIntegrity:{...payload.tokenPayloadExternal.appIntegrity,packageName:99}},
  ];
  for(const mutation of cases){
    const sample={tokenPayloadExternal:{...payload.tokenPayloadExternal,...mutation}};
    assert.equal(await decode(TOKEN,ACCESS,async()=>({
      ok:true,status:200,json:async()=>sample,
    })),null);
  }
});
test("unrecognized signed app verdict is returned for separate strict denial, never granted here",async()=>{
  const sample={tokenPayloadExternal:{
    ...payload.tokenPayloadExternal,
    appIntegrity:{...payload.tokenPayloadExternal.appIntegrity,appRecognitionVerdict:"UNRECOGNIZED_VERSION"},
  }};
  const result=await decode(TOKEN,ACCESS,async()=>({ok:true,status:200,json:async()=>sample}));
  assert.equal(result?.appIntegrity.appRecognitionVerdict,"UNRECOGNIZED_VERSION");
  assert.equal("premium" in result,false);
});
