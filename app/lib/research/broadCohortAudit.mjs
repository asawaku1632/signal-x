/** Zero-side-effect quality gate for an existing 30-stock, seven-slot scan archive.
 * Covers whole missing sessions as zero, not as success. READY_FOR_REVIEW
 * never triggers wider scans, Yahoo requests or actual trading changes.
 */
import {BROAD_SHADOW_SLOTS, BROAD_SHADOW_VERSION} from "./broadCohortShadow.mjs";
export const BROAD_AUDIT_START="2026-10-15";
export const BROAD_AUDIT_REQUIRED_DAYS=5;
export const BROAD_AUDIT_TARGET=30;
export const BROAD_AUDIT_MIN_COVERAGE=95;
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
const pct=(a,b)=>b>0?100*a/b:null;
const jstParts=(now)=>{
  const date=new Date(now);
  if(!Number.isFinite(date.getTime()))throw Error("INVALID_AUDIT_CLOCK");
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(date);
  const val=(s)=>parts.find(p=>p.type===s)?.value??"";
  return {date:val("year")+"-"+val("month")+"-"+val("day"),
    minute:Number(val("hour"))*60+Number(val("minute"))};
};
function shiftUtcDay(day,offset){
  return new Date(Date.parse(day+"T00:00:00Z")+offset*86400000).toISOString().slice(0,10);
}
/** Returns only market sessions whose seven capture windows have ALL closed.
 * Nontrading days and today before 15:40 JST are not counted as failures.
 * Dependency injected market calendar allows pure offline tests.
 */
export function expectedAuditTradingDates({now,isTradingDay,limit=5}){
  if(typeof isTradingDay!=="function"||!Number.isInteger(limit)||limit<1||limit>30)
    throw Error("INVALID_MARKET_CALENDAR");
  const today=jstParts(now);
  let date=today.minute>=15*60+40?today.date:shiftUtcDay(today.date,-1);
  const dates=[];
  for(let i=0;i<45&&dates.length<limit;i++){
    if(date<BROAD_AUDIT_START)break;
    if(isTradingDay(date))dates.push(date);
    date=shiftUtcDay(date,-1);
  }
  return dates;
}
export function auditBroadCohortQuality(archive,expectedDates){
  if(!Array.isArray(archive)||!Array.isArray(expectedDates)||
    expectedDates.some(d=>!dateRe.test(d))||new Set(expectedDates).size!==expectedDates.length)
    throw Error("INVALID_AUDIT_INPUT");
  const byDate=new Map();
  for(const row of archive){
    if(!expectedDates.includes(row?.trade_date)||row?.policy_version!==BROAD_SHADOW_VERSION)continue;
    const key=row.trade_date;
    if(!byDate.has(key))byDate.set(key,new Map());
    const slots=byDate.get(key);
    if(BROAD_SHADOW_SLOTS.includes(row.time_slot)&&!slots.has(row.time_slot))
      slots.set(row.time_slot,row);
  }
  let totalObserved=0,totalExpected=0,presentSlots=0,fullDays=0;
  const reasonTotals={};
  const days=expectedDates.map(date=>{
    const slots=byDate.get(date)??new Map();
    const observed=Array.from(slots.values()).reduce((n,r)=>n+Math.max(0,Number(r.observed_count)||0),0);
    const expected=BROAD_SHADOW_SLOTS.length*BROAD_AUDIT_TARGET;
    const missingSlots=BROAD_SHADOW_SLOTS.filter(s=>!slots.has(s));
    const underTarget=BROAD_SHADOW_SLOTS.filter(s=>slots.has(s)&&Number(slots.get(s).expected_count)!==BROAD_AUDIT_TARGET);
    const invalidCounts=BROAD_SHADOW_SLOTS.filter(s=>{
      if(!slots.has(s))return false;
      const r=slots.get(s);
      return Number(r.observed_count)<0||Number(r.observed_count)>Number(r.expected_count);
    });
    const reasons={};
    for(const r of slots.values()){
      if(!Array.isArray(r.missing))continue;
      for(const item of r.missing){
        const reason=String(item?.reason??"UNKNOWN");
        // Fixed labels, not source content, used for display. Dynamic reasons
        // are counted but do not ever enter JSX as markup.
        reasons[reason]=(reasons[reason]??0)+1;
        reasonTotals[reason]=(reasonTotals[reason]??0)+1;
      }
    }
    totalObserved+=observed;totalExpected+=expected;presentSlots+=slots.size;
    const full=missingSlots.length===0&&underTarget.length===0&&invalidCounts.length===0;
    if(full)fullDays++;
    return {date,slots:slots.size,expected,observed,coverage:pct(observed,expected),
      full,missingSlots,underTarget,invalidCounts,reasons};
  });
  const completeSample=expectedDates.length>=BROAD_AUDIT_REQUIRED_DAYS;
  const allSlotsPresent=days.every(d=>d.slots===BROAD_SHADOW_SLOTS.length);
  const allThirty=days.every(d=>d.full);
  const coverage=pct(totalObserved,totalExpected);
  const thresholdMet=completeSample&&allSlotsPresent&&allThirty&&
    totalExpected===BROAD_AUDIT_REQUIRED_DAYS*BROAD_SHADOW_SLOTS.length*BROAD_AUDIT_TARGET&&
    coverage!==null&&coverage>=BROAD_AUDIT_MIN_COVERAGE;
  return {status:thresholdMet?"READY_FOR_REVIEW":
    !completeSample?"COLLECTING":"QUALITY_GATE_BLOCKED",
    checkedSessions:expectedDates.length,neededSessions:BROAD_AUDIT_REQUIRED_DAYS,
    completeDays:fullDays,expectedSlots:expectedDates.length*BROAD_SHADOW_SLOTS.length,
    presentSlots,observed:totalObserved,expected:totalExpected,
    captureRate:coverage,missingReasonTotals:reasonTotals,
    days,targets:{stocks:BROAD_AUDIT_TARGET,slots:BROAD_SHADOW_SLOTS.length,
      rate:BROAD_AUDIT_MIN_COVERAGE},
    // Explicit guard: even readiness must never automatically increase the
    // daily stock count or imply a statistically valid return prediction.
    nextPhaseAutomatic:false};
}
