// Offline contract audit against the real Scan response shape.
// Checks structural readiness only. It cannot attest acquisition time or licenses.
export function auditScanPayloadForResearchCapture(payload) {
  if (!payload || !Array.isArray(payload.stocks)) return {ready:false,reason:"INVALID_SCAN_PAYLOAD",count:0,missing:{}};
  const missing={};
  const needs=["code","price","aiPower","latestBarTimestamp","dataSource"];
  for(const stock of payload.stocks) {
    for(const key of needs) {
      const value=stock?.[key];
      if(value===null || value===undefined || value==="") missing[key]=(missing[key]??0)+1;
    }
  }
  return {
    ready:payload.cached===false && payload.stocks.length>0 && Object.keys(missing).length===0,
    reason:payload.cached!==false?"CACHE_OR_UNKNOWN_GENERATION":
      payload.stocks.length===0?"EMPTY_SCAN":
      Object.keys(missing).length?"MISSING_CAPTURE_FIELDS":"STRUCTURE_ONLY_NOT_VERIFIED",
    count:payload.stocks.length,missing,
    independently_verified:false,source_license_verified:false
  };
}
