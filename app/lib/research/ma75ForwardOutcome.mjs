/**
 * SHADOW ONLY. Offline settlement for the pre-frozen SMA75 forward cohort.
 * NO network, cron, persistence, brokerage or production scoring.
 * Provider/market-calendar claims supplied as inputs are NOT independently certified.
 */
import { createHash } from 'node:crypto';
import { verifyMa75ForwardManifest } from './ma75ForwardProtocol.mjs';

export const MA75_FORWARD_OUTCOME_VERSION = 'ma75_forward_outcome_v1';
const DAY=/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const validDay=s=>typeof s==='string'&&DAY.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const time=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const closed=d=>Date.parse(d+'T06:30:00Z');
const opened=d=>Date.parse(d+'T00:00:00Z');
const round=(x,n=4)=>Number(x.toFixed(n));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity=(code,date)=>String(code??'?')+':'+String(date??'?');
const validBar=b=>b&&[b.open,b.high,b.low,b.close,b.volume].every(finite)&&
  b.open>0&&b.close>0&&b.low>0&&b.high>=Math.max(b.open,b.close,b.low)&&
  b.low<=Math.min(b.open,b.close,b.high)&&b.volume>=0;

/** Signal day plus the next five explicitly supplied *exchange sessions*. */
export function settleMa75ForwardOutcomes(manifest,replay,{exchangeSessions,outcomeBatches=[]}={}) {
  if (!verifyMa75ForwardManifest(manifest)||
      replay?.manifestSha256!==manifest.manifestSha256||
      !Array.isArray(replay?.candidates)||!Array.isArray(outcomeBatches))
    throw new TypeError('Require matching manifest, forward replay and outcome batches');
  if (!Array.isArray(exchangeSessions)||!exchangeSessions.length||
      exchangeSessions.some((d,i)=>!validDay(d)||(i>0&&d<=exchangeSessions[i-1])))
    throw new TypeError('Require unique ascending exchange session dates');
  const dateIndex=new Map(exchangeSessions.map((d,i)=>[d,i]));
  const incoming=new Map();
  const duplicateBatches=new Set();
  for (const b of outcomeBatches) {
    const id=identity(b?.code,b?.signalDate);
    if (incoming.has(id)) duplicateBatches.add(id);
    else incoming.set(id,b);
  }
  const ids=new Map();
  for(const c of replay.candidates){
    const id=identity(c?.code,c?.tradeDate);
    ids.set(id,(ids.get(id)??0)+1);
  }
  const results=[];
  for (const c of replay.candidates) {
    const id=identity(c?.code,c?.tradeDate);
    let status='PENDING_DATA',details=null;
    if (ids.get(id)!==1) status='QUARANTINED_DUPLICATE_CANDIDATE';
    else if (!manifest.codes.includes(c?.code)||!validDay(c?.tradeDate)||
      c.tradeDate<manifest.firstSignalDate) status='QUARANTINED_OUT_OF_COHORT';
    else {
      const position=dateIndex.get(c.tradeDate);
      if (position===undefined) status='PENDING_CALENDAR_SIGNAL';
      else if(position+5>=exchangeSessions.length) status='PENDING_CALENDAR_HORIZON';
      else if(c.id!==id||!Number.isFinite(time(c.signalRecordedAt))||
        time(c.signalRecordedAt)<closed(c.tradeDate)||
        time(c.signalRecordedAt)>=opened(exchangeSessions[position+1])||
        !finite(c.closingPrice)||c.closingPrice<=0)
        status='QUARANTINED_INVALID_SIGNAL';
      else if(duplicateBatches.has(id)) status='QUARANTINED_DUPLICATE_BATCH';
      else {
        const batch=incoming.get(id);
        if(!batch) status='PENDING_DATA';
        else if(batch.sourceProvider!==manifest.source.provider)
          status='QUARANTINED_SOURCE_MISMATCH';
        else {
          const dates=exchangeSessions.slice(position+1,position+6);
          const provided=batch.candles;
          if(!Array.isArray(provided)||provided.length===0) status='PENDING_DATA';
          else if(provided.some(b=>!validDay(b?.tradeDate)||!dates.includes(b.tradeDate))||
            new Set(provided.map(b=>b.tradeDate)).size!==provided.length||
            provided.length>5)
            status='QUARANTINED_WRONG_OR_DUPLICATE_SESSION';
          else if(provided.length<5) status='PENDING_MISSING_BARS';
          else {
            const bars=dates.map(d=>provided.find(b=>b.tradeDate===d));
            const receipt=time(batch.receivedAt);
            if(!Number.isFinite(receipt)||receipt<closed(dates[4]))
              status='QUARANTINED_INVALID_RECEIPT';
            else if(bars.some(b=>!b||!validBar(b)||time(b.barClosedAt)!==closed(b.tradeDate)||
              !Number.isFinite(time(b.capturedAt))||
              time(b.capturedAt)<time(b.barClosedAt)||time(b.capturedAt)>receipt))
              status='QUARANTINED_BAR_OR_PROVENANCE';
            else {
              const prices=[c.closingPrice,...bars.map(b=>b.close)];
              if(prices.slice(1).some((p,i)=>Math.abs(p/prices[i]-1)>0.45))
                status='QUARANTINED_CORPORATE_ACTION';
              else {
                const entry=bars[0].open*1.001;
                const exit3=bars[2].close*0.999;
                const exit5=bars[4].close*0.999;
                const low=Math.min(...bars.map(b=>b.low));
                const notional=entry*100;
                const record={id,code:c.code,signalDate:c.tradeDate,
                  entrySession:dates[0],exitSession3:dates[2],exitSession5:dates[4],
                  entryPrice:round(entry),exitPrice5:round(exit5),
                  return3Percent:round(100*(exit3/entry-1)),
                  return5Percent:round(100*(exit5/entry-1)),
                  profit5Yen100:Math.round((exit5-entry)*100),
                  maxAdverse5Percent:round(100*(low/entry-1)),
                  budgetEligible:notional>=100000&&notional<=500000,
                  sourceProvider:batch.sourceProvider,receivedAt:batch.receivedAt};
                details={...record,evidenceDigest:digest({
                  manifestSha256:manifest.manifestSha256,record,
                  bars:bars.map(b=>({tradeDate:b.tradeDate,open:b.open,high:b.high,
                    low:b.low,close:b.close,volume:b.volume,
                    barClosedAt:b.barClosedAt,capturedAt:b.capturedAt}))})};
                status='COMPLETED';
              }
            }
          }
        }
      }
    }
    results.push({id,status,details});
  }
  const complete=results.filter(x=>x.status==='COMPLETED');
  const mean=key=>complete.length?round(complete.reduce((a,b)=>a+b.details[key],0)/complete.length):null;
  return {version:MA75_FORWARD_OUTCOME_VERSION,manifestSha256:manifest.manifestSha256,
    totalCandidates:results.length,completed:complete.length,
    pending:results.filter(x=>x.status.startsWith('PENDING_')).length,
    quarantined:results.filter(x=>x.status.startsWith('QUARANTINED_')).length,
    completedCodes:new Set(complete.map(x=>x.details.code)).size,
    // These are hypothetical descriptive numbers, NOT verified forward results.
    hypotheticalAverage5Percent:mean('return5Percent'),
    validatedForwardWinRate:null,validatedForwardOutcomes:0,
    independentlyReproduced:false,
    average5Percent:mean('return5Percent'),
    positive5Percent:complete.length?round(100*complete.filter(x=>x.details.return5Percent>0).length/complete.length):null,
    budgetCompleted:complete.filter(x=>x.details.budgetEligible).length,
    results,eligibleForProduction:false,
    sourceIndependentlyVerified:false,exchangeCalendarIndependentlyVerified:false,
    proofOfLiveCapture:false,
    warnings:[
      'Data timestamps, source rights, actions and exchange-session dates require independent audit.',
      'Overlapping same-stock observations are not independent trials; sample may be selected.',
      'Returns model next-open entry and signal+5 close, 0.1% adverse each way, 100 shares, no taxes or actual fills.',
      'No-trade retest/cash policy needs separate opportunity-level accounting.',
      'Historical or synthetic observations are hypothetical even when structurally COMPLETED; independently validated forward rates remain null.',
    ]};
}
