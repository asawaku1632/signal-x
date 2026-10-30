/** Offline, metadata-only Yahoo 5m payload diagnosis. Never fetches, caches or saves market quotes. */
export function diagnoseOpeningChartPayload(payload, httpStatus=200){
 const status=Number.isInteger(httpStatus)?httpStatus:null;
 if(status===null||status<200||status>=300)return {kind:"HTTP_ERROR",httpStatus:status,hasFiveMinuteData:false};
 if(!payload||typeof payload!=="object")return {kind:"INVALID_JSON_SHAPE",httpStatus:status,hasFiveMinuteData:false};
 const chart=payload.chart;
 if(chart?.error)return {kind:"CHART_API_ERROR",httpStatus:status,hasFiveMinuteData:false};
 const result=chart?.result?.[0];
 if(!result)return {kind:"MISSING_CHART_RESULT",httpStatus:status,hasFiveMinuteData:false};
 const times=result.timestamp,quote=result.indicators?.quote?.[0];
 if(!Array.isArray(times))return {kind:"MISSING_TIMESTAMP_ARRAY",httpStatus:status,hasFiveMinuteData:false};
 if(!quote||typeof quote!=="object")return {kind:"MISSING_QUOTE_OBJECT",httpStatus:status,hasFiveMinuteData:false};
 const fields=["open","high","low","close","volume"];
 const missing=fields.filter(k=>!Array.isArray(quote[k]));
 if(missing.length)return {kind:"MISSING_QUOTE_FIELDS",httpStatus:status,missingFields:missing,hasFiveMinuteData:false};
 const lengths=Object.fromEntries(fields.map(k=>[k,quote[k].length]));
 if(times.length===0)return {kind:"EMPTY_TIMESTAMPS",httpStatus:status,barCount:0,hasFiveMinuteData:false};
 if(fields.some(k=>quote[k].length!==times.length))return {kind:"ARRAY_LENGTH_MISMATCH",httpStatus:status,barCount:times.length,fieldLengths:lengths,hasFiveMinuteData:false};
 return {kind:"STRUCTURALLY_PRESENT",httpStatus:status,barCount:times.length,hasFiveMinuteData:true,
  note:"Only shape checked: neither valid 09:00/09:05 candles nor licensing/decision-time provenance has been established."};
}
