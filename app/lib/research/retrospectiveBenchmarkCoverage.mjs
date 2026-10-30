/** Shadow-only benchmark coverage report. Never infer a regime from one saved post-close event. */
export function auditRetrospectiveBenchmarkCoverage(records,{minimumDates=20,minimumMonths=3}={}){
 if(!Array.isArray(records)||!Number.isInteger(minimumDates)||minimumDates<2||!Number.isInteger(minimumMonths)||minimumMonths<2)throw Error("INVALID_BENCHMARK_COVERAGE");
 const byDate=new Set(),months=new Set();let invalid=0,duplicates=0,valid=0;
 for(const r of records){
  const date=r?.trade_date;
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date||!Number.isFinite(r?.nikkei_close)||r.nikkei_close<=0||!Number.isFinite(r?.nikkei_previous_close)||r.nikkei_previous_close<=0){invalid++;continue;}
  if(byDate.has(date)){duplicates++;continue;}
  byDate.add(date);months.add(date.slice(0,7));valid++;
 }
 const blockers=[];
 if(valid<minimumDates)blockers.push("INSUFFICIENT_BENCHMARK_DATES");
 if(months.size<minimumMonths)blockers.push("INSUFFICIENT_BENCHMARK_MONTHS");
 if(duplicates)blockers.push("DUPLICATE_BENCHMARK_DATES");
 if(invalid)blockers.push("INVALID_BENCHMARK_RECORDS");
 blockers.push("INDEPENDENT_SOURCE_AND_AS_OF_ATTESTATION_MISSING");
 return {inputRecords:records.length,validDates:valid,representedMonths:months.size,invalid,duplicates,blockers,regimeValidated:false,readyForSignals:false,readyForTraining:false};
}
