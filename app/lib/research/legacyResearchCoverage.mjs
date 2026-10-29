/** Read-only retrospective coverage. Never treat legacy rows as verified morning evidence. */
export function auditLegacyCoverage(input = {}) {
 const {startDate,endDate,totalRows,pricedOutcomeRows,savedTimestampRows}=input;
 const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 if(!validDate(startDate)||!validDate(endDate)||startDate>endDate)throw Error("INVALID_DATE_RANGE");
 if(![totalRows,pricedOutcomeRows,savedTimestampRows].every(x=>Number.isSafeInteger(x)&&x>=0)||pricedOutcomeRows>totalRows||savedTimestampRows>totalRows)throw Error("INVALID_COVERAGE_COUNTS");
 return {period:{startDate,endDate},totalRows,pricedOutcomeRows,savedTimestampRows,
  outcomeCoverage:totalRows?pricedOutcomeRows/totalRows:null,
  historicalAnalysisOnly:true,verifiedPredecisionCount:null,
  independentVerification:false,trainingEnabled:false,notificationsEnabled:false,
  tradingEnabled:false,decision:"DO_NOT_PROMOTE"};
}
