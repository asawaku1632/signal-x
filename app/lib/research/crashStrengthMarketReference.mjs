/**
 * Parse settled Yahoo chart 1d reference closes. Never use regularMarketPrice:
 * the latter is live or stale and cannot be aligned with immutable saved stock dates.
 */
const valid = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
const jstDay = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(seconds * 1000));
};

/** @param {unknown} json */
export function parseCrashIndexDaily(json) {
  const chart = json?.chart?.result?.[0];
  const times = chart?.timestamp;
  const closes = chart?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(times) || !Array.isArray(closes) || times.length !== closes.length) {
    throw new Error("INVALID_REFERENCE_CHART");
  }
  const found = new Map();
  for (let i=0;i<times.length;i++) {
    const date = jstDay(Number(times[i]));
    if (!date || !valid(closes[i])) continue;
    // Last observation of that local date wins.
    found.set(date, Number(closes[i]));
  }
  if (!found.size) throw new Error("EMPTY_REFERENCE_CHART");
  return [...found].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,price])=>({date,price}));
}

/**
 * @param {{
 *   nikkei?: Array<{date:string,price:number}>,
 *   topix?: Array<{date:string,price:number}>,
 *   asOf:string
 * }} input
 */
export function joinCrashIndexSeries({nikkei=[],topix=[],asOf}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("INVALID_AS_OF_DATE");
  const rows = new Map();
  for(const [key,series] of [["nikkei",nikkei],["topix",topix]]){
    for(const item of series) {
      if(typeof item.date!=="string"||item.date>=asOf||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(item.date)||
         !valid(item.price))continue;
      if(!rows.has(item.date)) rows.set(item.date,{date:item.date,nikkei:null,topix:null});
      rows.get(item.date)[key]=item.price;
    }
  }
  return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
