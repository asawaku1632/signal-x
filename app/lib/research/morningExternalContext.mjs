/** Read-only morning context helpers. No price is made up and no trading signal is issued. */
export const EXTERNAL_MARKET_SYMBOLS = Object.freeze([
  {key:"dow",symbol:"^DJI",label:"NYダウ",zone:"America/New_York"},
  {key:"nasdaq",symbol:"^IXIC",label:"NASDAQ",zone:"America/New_York"},
  {key:"usdJpy",symbol:"JPY=X",label:"ドル円",zone:"Asia/Tokyo"},
]);
const positive=value=>typeof value==="number"&&Number.isFinite(value)&&value>0;

export function parseDailyMarketQuote(payload, zone, now=new Date()){
  const chart=payload?.chart?.result?.[0];
  const times=chart?.timestamp;
  const closes=chart?.indicators?.quote?.[0]?.close;
  if(!Array.isArray(times)||!Array.isArray(closes))return null;
  const latestNow=now.getTime();
  const valid=[];
  for(let i=0;i<Math.min(times.length,closes.length);i++){
    const time=Number(times[i])*1000,close=closes[i];
    if(!positive(close)||!Number.isFinite(time)||time<1_000_000_000_000||
      time>latestNow+86_400_000)continue;
    valid.push({time,close});
  }
  if(valid.length<2)return null;
  valid.sort((a,b)=>a.time-b.time);
  const previous=valid[valid.length-2],latest=valid[valid.length-1];
  if(latest.time===previous.time)return null;
  const observedDate=new Intl.DateTimeFormat("en-CA",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(latest.time));
  const age=latestNow-latest.time;
  return {
    price:Number(latest.close.toFixed(4)),
    changePct:Number((((latest.close-previous.close)/previous.close)*100).toFixed(2)),
    quoteDate:observedDate,
    state:age>5*86_400_000?"STALE":"REFERENCE",
  };
}

/** First five minutes measured against the PRIOR-NIGHT FROZEN REFERENCE.
 * The reference is NOT necessarily the official previous exchange close.
 * The 09:05 OPEN is all that the 09:08 study may use from that bar.
 */
export function interpretOpeningGap(reference,open0900,open0905){
  if(!positive(reference)||!positive(open0900)||!positive(open0905))return null;
  const gapPct=(open0900/reference-1)*100;
  const fiveMinutePct=(open0905/open0900-1)*100;
  const state=gapPct<=-0.5
    ?fiveMinutePct>0.1?"DOWN_REBOUND":fiveMinutePct< -0.1?"DOWN_CONTINUES":"DOWN_UNCLEAR"
    :gapPct>=0.5?"UP":"FLAT";
  const labels={
    DOWN_REBOUND:"安寄り後、最初の5分は反発方向",
    DOWN_CONTINUES:"安寄り後、最初の5分も下落方向",
    DOWN_UNCLEAR:"安寄り・最初の5分は方向未定",
    UP:"高寄り方向",FLAT:"前夜参考価格とほぼ同水準",
  };
  return {gapPct:Number(gapPct.toFixed(2)),
    firstFivePct:Number(fiveMinutePct.toFixed(2)),state,label:labels[state]};
}
