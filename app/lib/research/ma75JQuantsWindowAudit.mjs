/**
 * SHADOW ONLY. Offline, point-in-time-shaped MA75 replay from 76 completed
 * date-page audits. No HTTP, keys, database, queue, cron, live ranking or alerts.
 * The input archive can be obtained 12+ days later: therefore all computed
 * signals remain HISTORICAL HYPOTHESES, not actual as-of trading decisions.
 */
import { validateMa75FrozenUniverse } from './ma75FrozenUniverse.mjs';
import { MA75_JQUANTS_PAGE_VERSION } from './ma75JQuantsDailyPages.mjs';
export const MA75_JQUANTS_WINDOW_VERSION='ma75_jquants_offline_76_sessions_v1';
const day=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const number=x=>typeof x==='number'&&Number.isFinite(x);
const mean=values=>values.reduce((sum,x)=>sum+x,0)/values.length;
const round=x=>Number(x.toFixed(5));
const ID=(code,date)=>code+':'+date;
export function auditMa75JQuantsDailyWindow(freeze,{sessions,reports}={}){
  validateMa75FrozenUniverse(freeze);
  if(!Array.isArray(sessions)||sessions.length!==76||
     sessions.some((d,i)=>!day(d)||(i>0&&d<=sessions[i-1]))||
     sessions.at(-1)<freeze.firstEligibleSignalDate||
     !Array.isArray(reports))throw new TypeError('76 ascending declared sessions ending on a future-eligible date required');
  const signalDate=sessions.at(-1), dateSet=new Set(sessions);
  const reportByDate=new Map(),duplicateDates=new Set(),unexpectedDates=[];
  for(const r of reports){
    if(!dateSet.has(r?.date)){unexpectedDates.push(String(r?.date??'?'));continue}
    if(reportByDate.has(r.date))duplicateDates.add(r.date);
    else reportByDate.set(r.date,r);
  }
  const missingSessions=sessions.filter(d=>!reportByDate.has(d));
  const invalidReports=[];
  const validated=new Map();
  for(const date of sessions){
    const r=reportByDate.get(date);
    if(!r)continue;
    let reason=null;
    if(duplicateDates.has(date))reason='DUPLICATE_DATE_PAGE_AUDIT';
    else if(r.version!==MA75_JQUANTS_PAGE_VERSION||
      r.paginationComplete!==true||r.failures?.length!==0||
      r.expectedFrozenCodes!==freeze.codes.length||!Array.isArray(r.rows)||
      r.rows.length!==freeze.codes.length||r.providerRightsVerified!==false||
      r.eligibleForForwardSignal!==false)
      reason='INVALID_OR_INCOMPLETE_PAGE_AUDIT';
    else if(r.rows.some((row,i)=>row?.code!==freeze.codes[i]||
      row.tradeDate!==date||
      !['DAILY_BAR','NO_TRADE','MISSING_PROVIDER_ROW','INVALID_OHLCV','DUPLICATE_CODE_DATE','BLOCKED_PAGINATION'].includes(row.status)||
      (row.status==='DAILY_BAR'&&(
        row.bar?.code!==row.code||row.bar?.tradeDate!==date||row.bar?.unadjusted!==true||
        ![row.bar.open,row.bar.high,row.bar.low,row.bar.close,row.bar.volume].every(number)||
        row.bar.open<=0||row.bar.close<=0||row.bar.low<=0||row.bar.high<=0||row.bar.volume<=0||
        row.bar.low>Math.min(row.bar.open,row.bar.close,row.bar.high)||
        row.bar.high<Math.max(row.bar.open,row.bar.close,row.bar.low)))||
      (row.status!=='DAILY_BAR'&&row.bar!==null))))
      reason='INCONSISTENT_OR_TAMPERED_CODE_ROWS';
    if(reason)invalidReports.push({date,reason});
    else validated.set(date,r.rows);
  }
  const rows=[];
  for(let i=0;i<freeze.codes.length;i++){
    const code=freeze.codes[i],values=[];
    let status='HISTORY_INCOMPLETE',signal=null,reason=null;
    if(missingSessions.length||duplicateDates.size||invalidReports.length){
      reason='GLOBAL_PAGE_WINDOW_INCOMPLETE';
    }else{
      const statuses=[];
      for(const date of sessions){
        const row=validated.get(date)[i];
        statuses.push(row.status);
        if(row.status==='DAILY_BAR')values.push(row.bar);
      }
      if(statuses.some(s=>s==='NO_TRADE'))reason='NO_TRADE_SESSION';
      else if(statuses.some(s=>s!=='DAILY_BAR'))reason='MISSING_OR_INVALID_PROVIDER_ROW';
      else if(values.some((bar,j)=>j>0&&Math.abs(bar.close/values[j-1].close-1)>0.45))
        reason='SPLIT_OR_CORPORATE_ACTION_UNVERIFIED';
      else {
        const yesterday=values[74],today=values[75];
        const prevSma=mean(values.slice(0,75).map(b=>b.close));
        const sma=mean(values.slice(1,76).map(b=>b.close));
        const volumeAvg=mean(values.slice(55,75).map(b=>b.volume));
        if(!Number.isFinite(volumeAvg)||volumeAvg<=0)reason='INVALID_VOLUME_BASELINE';
        else {
          const crossover=today.close>sma&&yesterday.close<=prevSma;
          status=crossover?'BREAKOUT_OFFLINE_ONLY':'NO_CROSS_OFFLINE_ONLY';
          signal={tradeDate:signalDate,code,close:today.close,
            sma75:round(sma),priorClose:yesterday.close,priorSma75:round(prevSma),
            sma75Rising:sma>prevSma,
            prior20VolumeRatio:round(today.volume/volumeAvg),
            crossover,unadjusted:true,source:'J-Quants v2 offline date pages',
            asOfLiveCaptureVerified:false};
        }
      }
    }
    rows.push({id:ID(code,signalDate),code,status,reason,signal});
  }
  const counts={};
  for(const row of rows)counts[row.status]=(counts[row.status]??0)+1;
  return {
    version:MA75_JQUANTS_WINDOW_VERSION,signalDate,
    expectedFrozenCodes:freeze.codes.length,expectedSessions:76,
    suppliedReports:reports.length,uniqueValidReports:validated.size,
    missingSessions,invalidReports,duplicateDates:[...duplicateDates].sort(),
    unexpectedDates,rows,counts,
    structuralCoverageComplete:rows.every(r=>
      r.status==='BREAKOUT_OFFLINE_ONLY'||r.status==='NO_CROSS_OFFLINE_ONLY'),
    generatedForwardSignals:0,independentlyVerifiedAsOfAvailability:false,
    independentlyVerifiedProviderRights:false,officialCalendarVerified:false,
    eligibleForAIPowerScoring:false,eligibleForNotifications:false,
    eligibleForProduction:false,
    warnings:[
      'Offline bar pages are not live as-of timestamp evidence, even if a receivedAt field exists.',
      'Every frozen code must have all 76 complete sessions; missing or no-trade history stays in the denominator.',
      'This retrospective 75-day calculation cannot be promoted without a verified point-in-time adjustment and corporate-action audit.',
    ],
  };
}
