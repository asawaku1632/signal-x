import {isTseTradingDate,resolveTseTradingDatesAfter,TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
export type FiveDayAuditRow={trade_date:string;code:string;return_5d:string|null;outcome_5d_date:string|null};
export type FiveDayAuditIssue={code:string;tradeDate:string;reason:string;expectedDate:string|null;actualDate:string|null};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function auditFiveDayTradingCalendar(rows:FiveDayAuditRow[],limit=100){
 const issues:FiveDayAuditIssue[]=[];
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000||rows.length>limit)throw Error("AUDIT_SAMPLE_LIMIT_EXCEEDED");
 for(const row of rows){
  let reason="",expectedDate:string|null=null;
  const date=row.trade_date,actualDate=row.outcome_5d_date;
  if(!datePattern.test(date)||!row.code?.trim()||(actualDate!==null&&!datePattern.test(actualDate))){reason="INVALID_ROW_FORMAT";}
  else{
   try{
    if(!isTseTradingDate(date))reason="SIGNAL_NOT_TSE_SESSION";
    else{
     expectedDate=resolveTseTradingDatesAfter(date,5,{maxLookaheadDays:20})[4];
     if(actualDate!==null&&!isTseTradingDate(actualDate))reason="OUTCOME_NOT_TSE_SESSION";
     else if(actualDate!==null&&actualDate!==expectedDate)reason="FIVE_DAY_TARGET_MISMATCH";
     else if(row.return_5d!==null&&actualDate===null)reason="RETURN_MISSING_OUTCOME_DATE";
     else if(row.return_5d===null&&actualDate!==null)reason="DATE_MISSING_RETURN";
     else if(row.return_5d!==null&&!Number.isFinite(Number(row.return_5d)))reason="INVALID_RETURN";
    }
   }catch{reason="MARKET_CALENDAR_UNAVAILABLE";}
  }
  if(reason)issues.push({code:row.code,tradeDate:date,reason,expectedDate,actualDate});
 }
 return {inspected:rows.length,issues,calendarVersion:TSE_MARKET_CALENDAR_VERSION,
  sampleOnly:true as const,exhaustive:false as const,sourceVerified:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
