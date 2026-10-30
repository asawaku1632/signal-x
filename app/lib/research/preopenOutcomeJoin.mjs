/** Shadow-only chronological research join. Each date gets one equal-weight contribution.
 * Scores/outcomes from later snapshots must NOT be treated as ex-ante verified.
 */
export function auditPreopenOutcomeJoin(partition,outcomeDays){
 if(!partition||!Array.isArray(partition.dates)||!Array.isArray(outcomeDays))throw Error("INVALID_OUTCOME_JOIN");
 const byDay=new Map();
 for(const x of outcomeDays){
  if(typeof x?.date!=="string"||byDay.has(x.date))throw Error("DUPLICATE_OR_INVALID_OUTCOME_DATE");
  byDay.set(x.date,x);
 }
 const counts={dates:partition.dates.length,ageScreened:0,excludedBySourceAge:0,pendingOutcome:0,validOutcomeDays:0};
 const days=partition.dates.map(x=>{
  const y=byDay.get(x.date);
  if(x.status!=="AGE_SCREEN_ONLY"){counts.excludedBySourceAge++;return {date:x.date,status:"SOURCE_AGE_EXCLUDED",reason:x.reasons??[]};}
  counts.ageScreened++;
  if(!y||!Number.isInteger(y.pairs)||y.pairs<=0||!Number.isInteger(y.high)||!Number.isInteger(y.low)||y.high<=0||y.low<=0||y.high+y.low!==y.pairs){counts.pendingOutcome++;return {date:x.date,status:"OUTCOME_INCOMPLETE"};}
  counts.validOutcomeDays++;return {date:x.date,status:"DESCRIPTIVE_ONLY",pairs:y.pairs,high:y.high,low:y.low};
 });
 return {counts,days,modelTrainingAllowed:false,notificationAllowed:false,exAnteVerified:false,
 warning:"Saved same-record scores and outcomes are descriptive only; cohort metrics cannot authenticate feature decision-time availability."};
}
