/** Offline candidate-advantage audit. No IO, imports of production APIs, or side effects.
 * Rows must be independently prepared, dated out-of-sample comparisons against a
 * predeclared baseline on the SAME trade date. Caller assertions are not proof.
 */
const finite = x => typeof x === "number" && Number.isFinite(x);
const dateOK = x => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x)) && new Date(x + "T00:00:00Z").toISOString().slice(0,10) === x;
const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
export function auditCandidateAdvantage(rows, opts={}) {
  if(!Array.isArray(rows) || rows.length > 100000) throw Error("INVALID_RESEARCH_ROWS");
  const minDates=opts.minDates ?? 30, minMonths=opts.minMonths ?? 3;
  if(!Number.isInteger(minDates)||minDates<20||!Number.isInteger(minMonths)||minMonths<2)
    throw Error("UNSAFE_RESEARCH_POLICY");
  const reasons=[], accepted=[], seen=new Set(), duplicates=new Set();
  let invalid=0;
  for(const r of rows) {
    if(!r || !dateOK(r.tradeDate) || typeof r.code!=="string" ||
      !/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code) || typeof r.ruleId!=="string" ||
      !r.ruleId.trim() || !finite(r.candidateReturnPct) || !finite(r.baselineReturnPct) ||
      r.outOfSample!==true || r.predecisionSnapshotVerified!==true ||
      r.outcomeProvenanceVerified!==true || r.costsIncluded!==true ||
      r.baselinePredeclared!==true) { invalid++; continue; }
    const k=r.ruleId+"|"+r.tradeDate+"|"+r.code;
    if(seen.has(k)) duplicates.add(k);
    seen.add(k); accepted.push({...r,_key:k});
  }
  // Ambiguous duplicates invalidate the whole stock/date/rule, not only the second row.
  const clean=accepted.filter(r=>!duplicates.has(r._key));
  const ids=new Set(clean.map(r=>r.ruleId));
  if(invalid) reasons.push("UNVERIFIED_ROWS");
  if(duplicates.size) reasons.push("DUPLICATE_STOCK_DATE_RULE");
  if(ids.size!==1) reasons.push("REQUIRE_SINGLE_FIXED_RULE");
  const days=new Map();
  for(const r of clean) {
    const a=days.get(r.tradeDate)??[];a.push(r.candidateReturnPct-r.baselineReturnPct);
    days.set(r.tradeDate,a);
  }
  const daily=[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,gaps])=>({date,gap:avg(gaps)}));
  const months=new Set(daily.map(d=>d.date.slice(0,7))).size;
  const gaps=daily.map(d=>d.gap), meanGap=avg(gaps);
  const positiveDays=gaps.filter(x=>x>0).length;
  const half=Math.floor(gaps.length/2);
  const early=avg(gaps.slice(0,half)),late=avg(gaps.slice(half));
  if(daily.length<minDates)reasons.push("INSUFFICIENT_DATES");
  if(months<minMonths)reasons.push("INSUFFICIENT_MONTHS");
  if(meanGap===null||meanGap<=0)reasons.push("NO_POSITIVE_DATE_MATCHED_EDGE");
  if(gaps.length<2||positiveDays/gaps.length<=0.5)reasons.push("NO_MAJORITY_POSITIVE_DAYS");
  if(early===null||late===null||early<=0||late<=0)reasons.push("NO_SPLIT_PERIOD_REPLICATION");
  // Independent licensing, frozen inputs, and execution audit need external review.
  reasons.push("INDEPENDENT_AUDIT_AND_HUMAN_RELEASE_REQUIRED");
  return {version:"CANDIDATE_ADVANTAGE_OFFLINE_V1",status:"BLOCKED",
    researchCandidate:reasons.length===1,
    productionEligible:false,notificationsEnabled:false,trainingEnabled:false,
    counts:{received:rows.length,accepted:clean.length,invalid,duplicates:duplicates.size,
      tradingDays:daily.length,months},
    metrics:{dateMatchedMeanEdgePct:meanGap,positiveDays,earlyMeanEdgePct:early,lateMeanEdgePct:late},
    reasons,note:"Exploratory offline audit only; caller proof flags are not independently authenticated."};
}
