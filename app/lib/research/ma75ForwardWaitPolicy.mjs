/**
 * SHADOW ONLY. Retrospective settlement of a PRE-FROZEN SMA75 breakout's two
 * feasible policies: buy next open vs wait ten sessions for a support retest.
 * All 15 post-signal sessions must be observed. No API, database or live trade.
 * Input timestamps and exchange sessions are claims, not independent evidence.
 */
import { verifyMa75ForwardManifest } from './ma75ForwardProtocol.mjs';

export const MA75_FORWARD_WAIT_VERSION='ma75_forward_wait_policy_v1';
const isNum=x=>typeof x==='number'&&Number.isFinite(x);
const time=x=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
const end=d=>Date.parse(d+'T06:30:00Z');
const validDay=d=>typeof d==='string'&&/^20\d\d-\d\d-\d\d$/.test(d)&&
  Number.isFinite(end(d))&&new Date(end(d)).toISOString().slice(0,10)===d;
const start=d=>Date.parse(d+'T00:00:00Z');
const round=x=>Number(x.toFixed(4));
const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const good=b=>b&&typeof b.tradeDate==='string'&&
  [b.open,b.high,b.low,b.close,b.volume].every(isNum)&&b.open>0&&b.close>0&&
  b.low>0&&b.high>=Math.max(b.low,b.open,b.close)&&b.low<=Math.min(b.open,b.close)&&b.volume>=0;
const key=(code,date)=>String(code)+':'+String(date);
export function auditMa75ForwardWaitPolicy(manifest,replay,{exchangeSessions,batches=[]}={}){
  if(!verifyMa75ForwardManifest(manifest)||replay?.manifestSha256!==manifest.manifestSha256||
     !Array.isArray(replay?.candidates)||!Array.isArray(batches))
    throw new TypeError('Require matching frozen manifest and replay');
  if(!Array.isArray(exchangeSessions)||exchangeSessions.some((d,i)=>
      !validDay(d)||i>0&&exchangeSessions[i-1]>=d))
    throw new TypeError('Invalid ordered exchange calendar');
  const counts=new Map();
  for(const c of replay.candidates){const id=key(c?.code,c?.tradeDate);counts.set(id,(counts.get(id)||0)+1)}
  const grouped=new Map();
  for(const b of batches){const id=key(b?.code,b?.signalDate);grouped.set(id,[...(grouped.get(id)||[]),b])}
  const sessions=new Map(exchangeSessions.map((d,i)=>[d,i]));
  const observations=[];
  for(const c of replay.candidates){
    const id=key(c?.code,c?.tradeDate);
    let status='PENDING_DATA', detail=null;
    if(counts.get(id)!==1)status='QUARANTINED_DUPLICATE_SIGNAL';
    else if(!manifest.codes.includes(c.code)||c.tradeDate<manifest.firstSignalDate||
      c.id!==id||!c.variantMatches?.BREAKOUT_ALL)status='QUARANTINED_SIGNAL';
    else if(!sessions.has(c.tradeDate))status='PENDING_CALENDAR';
    else {
      const pos=sessions.get(c.tradeDate);
      if(pos+15>=exchangeSessions.length)status='PENDING_HORIZON';
      else if((grouped.get(id)||[]).length>1)status='QUARANTINED_DUPLICATE_BATCH';
      else if(!(grouped.get(id)||[]).length)status='PENDING_DATA';
      else {
        const b=grouped.get(id)[0];
        const historic=b.history, future=b.future;
        const dates=exchangeSessions.slice(pos+1,pos+16);
        if(b.sourceProvider!==manifest.source.provider)status='QUARANTINED_SOURCE';
        else if(!Array.isArray(historic)||historic.length<76||!Array.isArray(future)||future.length<15)
          status='PENDING_BARS';
        else if(historic.at(-1)?.tradeDate!==c.tradeDate||future.length!==15||
          future.some((x,i)=>x?.tradeDate!==dates[i])||
          historic.some((x,i)=>!good(x)||i>0&&historic[i-1].tradeDate>=x.tradeDate)||
          future.some(x=>!good(x)))status='QUARANTINED_BARS';
        else {
          const receipt=time(b.receivedAt),historyCapture=time(b.historyCapturedAt),signal=time(c.signalRecordedAt);
          const nextOpen=start(dates[0]);
          if(!Number.isFinite(receipt)||receipt<end(dates[14])||
            !Number.isFinite(historyCapture)||historyCapture<end(c.tradeDate)||
            !Number.isFinite(signal)||signal<historyCapture||signal>=nextOpen||
            !isNum(c.closingPrice)||!isNum(c.sma75))status='QUARANTINED_ASOF';
          else if(future.some(x=>time(x.closedAt)!==end(x.tradeDate)||
             !Number.isFinite(time(x.capturedAt))||time(x.capturedAt)<end(x.tradeDate)||
             time(x.capturedAt)>receipt))status='QUARANTINED_CAPTURE';
          else {
            const all=[...historic,...future];
            const n=historic.length-1;
            const smaAt=i=>avg(all.slice(i-74,i+1).map(x=>x.close));
            const asOfSma=smaAt(n);
            if(Math.abs(asOfSma-c.sma75)>0.001||
               Math.abs(all[n].close-c.closingPrice)>0.001||
               !(all[n].close>asOfSma&&all[n-1].close<=smaAt(n-1)))
              status='QUARANTINED_ASOF_RECALC';
            else if(all.slice(-91).some((bar,i,tail)=>i>0&&
                Math.abs(bar.close/tail[i-1].close-1)>0.45))
              status='QUARANTINED_CORPORATE_ACTION';
            else {
              let retest=null,invalidated=false;
              for(let j=1;j<=10;j++){
                const bar=all[n+j],sma=smaAt(n+j);
                if(bar.low<=sma*1.01&&bar.close>=sma&&bar.close>=bar.open){retest=j;break}
                if(bar.close<sma){invalidated=true;break}
              }
              const breakoutEntry=future[0].open*1.001;
              const breakoutExit=future[4].close*.999;
              const bought=retest!==null;
              const waitEntry=bought?future[retest].open*1.001:null;
              const waitExit=bought?future[retest+4].close*.999:null;
              detail={id,code:c.code,signalDate:c.tradeDate,
                breakoutReturn5Percent:round(100*(breakoutExit/breakoutEntry-1)),
                waitReturn5Percent:bought?round(100*(waitExit/waitEntry-1)):0,
                retestSession:bought?dates[retest-1]:null,
                waitEntrySession:bought?dates[retest]:null,
                waitExitSession:bought?dates[retest+4]:null,
                waitTraded:bought,waitCash:!bought,invalidated,
                breakoutBudgetEligible:breakoutEntry*100>=100000&&breakoutEntry*100<=500000,
                waitBudgetEligible:bought?waitEntry*100>=100000&&waitEntry*100<=500000:false};
              status='COMPLETED_HYPOTHETICAL';
            }
          }
        }
      }
    }
    observations.push({id,status,detail});
  }
  const finished=observations.filter(x=>x.status==='COMPLETED_HYPOTHETICAL');
  const mean=k=>finished.length?round(avg(finished.map(x=>x.detail[k]))):null;
  return {version:MA75_FORWARD_WAIT_VERSION,manifestSha256:manifest.manifestSha256,
    candidates:observations.length,complete:finished.length,
    pending:observations.filter(x=>x.status.startsWith('PENDING_')).length,
    quarantined:observations.filter(x=>x.status.startsWith('QUARANTINED_')).length,
    tradedRetests:finished.filter(x=>x.detail.waitTraded).length,
    cashOpportunities:finished.filter(x=>x.detail.waitCash).length,
    hypotheticalBreakoutMean:mean('breakoutReturn5Percent'),
    hypotheticalWaitOrCashMean:mean('waitReturn5Percent'),
    observations,validatedForwardWinRate:null,eligibleForProduction:false,
    sourceVerifiedIndependently:false,calendarVerifiedIndependently:false,
    warnings:['Historical-input and self-reported capture dates are not audited real-time predictions.',
      'All five-day retest opportunities are included, including those never traded.',
      'Capital exposure differs between next-open and wait-or-cash; no realized broker fills.']};
}
