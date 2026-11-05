/**
 * FROZEN NEXT-PERIOD REPLICATION PLAN (not market data, not a strategy).
 * This file was predeclared before the first planned 2026-11-06 session.
 * Git history is the evidence for when this plan was authored.
 *
 * Every symbol and every session is fixed; no outcome-driven substitutions.
 */
import {
 TSE_MARKET_CALENDAR,resolveTseTradingDatesAfter,isTseTradingDate,
} from '../technicalObservation/tseMarketCalendar.ts';
import {FOUR_PATTERN_RULES} from './fourStrategyShadow.mjs';

export const FOUR_PATTERN_REPLICATION_PLAN_VERSION='four_pattern_replication_preregistered_20261105_v1';
export const REPLICATION_PLAN=Object.freeze({
 version:FOUR_PATTERN_REPLICATION_PLAN_VERSION,
 predeclaredOn:'2026-11-05',
 referencePeriod:Object.freeze({
  start:'2026-10-06',end:'2026-11-04',
  previouslyStudiedCodes:Object.freeze(['3762','7203','7752']),
 }),
 plannedNextPeriod:Object.freeze({
  start:'2026-11-06',end:'2026-12-04',
  tradingDates:Object.freeze([
   '2026-11-06','2026-11-09','2026-11-10','2026-11-11',
   '2026-11-12','2026-11-13','2026-11-16','2026-11-17',
   '2026-11-18','2026-11-19','2026-11-20','2026-11-24',
   '2026-11-25','2026-11-26','2026-11-27','2026-11-30',
   '2026-12-01','2026-12-02','2026-12-03','2026-12-04',
  ]),
  codes:Object.freeze(['1301','3402','3762','7203','7752','9005']),
  newComparisonCodes:Object.freeze(['1301','3402','9005']),
  previouslyStudiedCodes:Object.freeze(['3762','7203','7752']),
 }),
 studyDesign:Object.freeze({
  marketCalendarVersion:TSE_MARKET_CALENDAR.version,
  candleTimeframes:Object.freeze(['30m','60m']),
  priceOnlyStrategies:Object.freeze(['BREAKOUT_RETEST','EMA_COMPRESSION','HIGHER_LOW']),
  excludedStrategy:'QUALITY_PULLBACK',
  holdTradingDays:Object.freeze([1,3,5]),
  buy:'NEXT_JPX_TRADING_DAY_FIRST_EXECUTED_OPEN',
  sell:'TARGET_JPX_TRADING_DAY_LAST_EXECUTED_CLOSE',
  shares:FOUR_PATTERN_RULES.shares,
  frictionEachSide:FOUR_PATTERN_RULES.perSideFriction,
  maxBudgetYen:FOUR_PATTERN_RULES.maxBudgetYen,
  portfolioDedup:'EARLIEST_CLOSED_SIGNAL_PER_STOCK_DATE_NOT_MAXIMUM_PROFIT',
  timeframeDedup:'EARLIEST_CLOSED_SIGNAL_PER_STOCK_DATE_STRATEGY',
  outcomePending:'NEVER_FILL_FROM_PARTIAL_LAST_DAY',
 }),
});
const fail=x=>{throw new TypeError(x)}
export function verifyFourPatternReplicationPlan({
 plan=REPLICATION_PLAN,calendar=TSE_MARKET_CALENDAR,
}={}){
 try{
  if(!calendar||calendar.version!==plan?.studyDesign?.marketCalendarVersion)
   fail('REPLICATION_CALENDAR_VERSION_MISMATCH');
  if(plan?.predeclaredOn!=='2026-11-05'||
   plan.referencePeriod.end>='2026-11-06'||plan.plannedNextPeriod.start!=='2026-11-06'||
   plan.plannedNextPeriod.end!=='2026-12-04')
   fail('REPLICATION_DATE_SPLIT_INVALID');
  const dates=plan.plannedNextPeriod.tradingDates;
  if(!Array.isArray(dates)||dates.length!==20||
   new Set(dates).size!==20||dates[0]!=='2026-11-06'||
   dates.at(-1)!=='2026-12-04')
   fail('REPLICATION_DATE_SET_INVALID');
  const expected=resolveTseTradingDatesAfter('2026-11-05',20,{
   calendar,maxLookaheadDays:40,
  });
  if(dates.some((x,i)=>x!==expected[i]||!isTseTradingDate(x,calendar)))
   fail('REPLICATION_DATE_SET_NOT_CONTIGUOUS');
  const codes=plan.plannedNextPeriod.codes,reference=plan.referencePeriod.previouslyStudiedCodes;
  if(!Array.isArray(codes)||codes.length!==6||new Set(codes).size!==6||
   !Array.isArray(reference)||reference.join(',')!=='3762,7203,7752'||
   !['1301','3402','3762','7203','7752','9005'].every(x=>codes.includes(x))||
   plan.plannedNextPeriod.newComparisonCodes.join(',')!=='1301,3402,9005')
   fail('REPLICATION_STOCK_COHORT_CHANGED');
  const design=plan.studyDesign;
  if(design.shares!==FOUR_PATTERN_RULES.shares||
   design.frictionEachSide!==FOUR_PATTERN_RULES.perSideFriction||
   design.maxBudgetYen!==FOUR_PATTERN_RULES.maxBudgetYen||
   design.holdTradingDays.join(',')!=='1,3,5'||
   design.priceOnlyStrategies.join(',')!=='BREAKOUT_RETEST,EMA_COMPRESSION,HIGHER_LOW')
   fail('REPLICATION_FROZEN_RULES_CHANGED');
  return {status:'PREDECLARED_HOLDOUT_PLAN_ONLY',
   version:plan.version,predeclaredOn:plan.predeclaredOn,
   referenceWindow:plan.referencePeriod,
   targetWindow:plan.plannedNextPeriod,
   studyDesign:plan.studyDesign,
   dataAcquired:false,backtestCompleted:false,
   forwardMarketAvailabilityProven:false,
   productionReady:false,notificationEligible:false,
   notes:[
    'This is a fixed future research plan, NOT an executed out-of-sample test.',
    'J-Quants daily/minute archives may not become available immediately at a session close.',
    'The final 5 trading-day labels may remain PENDING until later official sessions are separately verified.',
    'No substitution of stocks or dates based on observed outcomes is permitted.',
   ],
  };
 }catch(error){
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'REPLICATION_PLAN_UNVERIFIED';
  return {status:'BLOCKED_'+code,productionReady:false,notificationEligible:false};
 }
}
