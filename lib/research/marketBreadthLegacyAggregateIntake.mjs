// Read-only aggregate intake for a separately authorized, nonproduction PostgreSQL export.
// Never connects to databases or handles credentials, individual trades or personal data.
const integer=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export function inspectLegacyAggregateExport({summary,daily=[],duplicates}={}){
 if(!summary||!Array.isArray(daily)||daily.length>3660||!duplicates)throw new TypeError('INVALID_AGGREGATE_EXPORT');
 const counts=['total_rows','distinct_signal_dates','distinct_stock_codes','wins','losses','holds','unknowns','checked_rows','future_prices','return_rows','temporal_conflicts','save_date_mismatches'];
 if(counts.some(k=>!integer(summary[k]))||!integer(duplicates.duplicate_stock_date_groups)||!integer(duplicates.duplicate_extra_rows))throw new TypeError('INVALID_AGGREGATE_COUNT');
 if(summary.wins+summary.losses+summary.holds+summary.unknowns!==summary.total_rows)throw new TypeError('INCONSISTENT_RESULT_TOTALS');
 if(['checked_rows','future_prices','return_rows','temporal_conflicts','save_date_mismatches'].some(k=>summary[k]>summary.total_rows)||duplicates.duplicate_extra_rows>summary.total_rows)throw new TypeError('IMPOSSIBLE_AGGREGATE_COUNT');
 if(summary.total_rows===0){if(summary.distinct_signal_dates!==0||summary.distinct_stock_codes!==0||summary.first_signal_date!==null||summary.last_signal_date!==null||daily.length)throw new TypeError('INCONSISTENT_EMPTY_EXPORT')}
 else if(!date(summary.first_signal_date)||!date(summary.last_signal_date)||summary.first_signal_date>summary.last_signal_date||summary.distinct_signal_dates<1||summary.distinct_stock_codes<1)throw new TypeError('INVALID_AGGREGATE_DATE_RANGE');
 const seen=new Set();
 for(const r of daily){
  if(!r||!date(r.signal_date)||!['rows','resolved','evaluated','priced'].every(k=>integer(r[k]))||r.resolved>r.rows||r.evaluated>r.rows||r.priced>r.rows||seen.has(r.signal_date))throw new TypeError('INVALID_DAILY_AGGREGATE');
  if(summary.total_rows&& (r.signal_date<summary.first_signal_date||r.signal_date>summary.last_signal_date))throw new TypeError('DAILY_DATE_OUTSIDE_RANGE');
  seen.add(r.signal_date);
 }
 if(daily.length>summary.distinct_signal_dates||daily.reduce((n,r)=>n+r.rows,0)>summary.total_rows||daily.reduce((n,r)=>n+r.resolved,0)>summary.wins+summary.losses)throw new TypeError('INCONSISTENT_DAILY_TOTALS');
 const limitations=['AGGREGATE_ONLY_NO_STOCK_LEVEL_OUTCOMES','ORIGINAL_SIGNAL_TIMES_UNATTESTED','FIVE_SESSION_HORIZON_UNATTESTED','INDEPENDENT_PRICES_UNATTESTED','NO_FROZEN_HOLDOUT_OR_COSTS'];
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,independentImprovementVerified:false,coverage:{rows:summary.total_rows,distinctDates:summary.distinct_signal_dates,distinctCodes:summary.distinct_stock_codes,firstDate:summary.first_signal_date,lastDate:summary.last_signal_date,judged:summary.wins+summary.losses,unresolved:summary.unknowns,daysIncluded:daily.length,duplicateExtraRows:duplicates.duplicate_extra_rows,temporalConflicts:summary.temporal_conflicts,saveDateMismatches:summary.save_date_mismatches},requiresFollowup:summary.total_rows>0,limitations};
}
