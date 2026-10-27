import { verifyResearchDatasetBytes } from "./dailyForwardDatasetIntegrity.mjs";
import { runForwardResearchExperimentPipeline } from "./dailyForwardExperimentPipeline.mjs";

/**
 * Decode a single immutable research bundle, verify its exact bytes against
 * an independently pinned expected SHA-256, then run all diagnostics from
 * the decoded bundle. No separately supplied arrays or claimed hashes.
 */
export function runVerifiedForwardExperimentBundle({
  datasetBytes, trustedExpectedSha256,
  minPairedSamples=100,minDistinctDates=20,minDistinctCodes=20,minTrades=30,
}={}) {
  const blocked=(reason)=>({status:"BLOCKED",reasons:[reason],
    improvementProven:false,productionApproval:false,autoApply:false,productionWrites:false});
  if(!Buffer.isBuffer(datasetBytes)&&!(datasetBytes instanceof Uint8Array))
    return blocked("DATASET_BYTES_REQUIRED");
  const verification=verifyResearchDatasetBytes(datasetBytes,trustedExpectedSha256);
  if(!verification.matches) return {...blocked("DATASET_HASH_MISMATCH"),verification};
  let bundle;
  try {bundle=JSON.parse(Buffer.from(datasetBytes).toString("utf8"));}
  catch {return blocked("DATASET_JSON_INVALID");}
  if(!bundle||typeof bundle!=="object"||Array.isArray(bundle)||
     !Array.isArray(bundle.baselineRows)||!Array.isArray(bundle.experimentalRows)||
     !Array.isArray(bundle.pairedRows)||!Array.isArray(bundle.hypotheticalTrades)||
     !bundle.plan||typeof bundle.plan!=="object")
    return blocked("DATASET_SCHEMA_INVALID");
  // Recompute paired values from the baseline/experimental rows, rather than
  // trusting a third caller-supplied series of differences.
  const index=new Map();
  for(const row of bundle.baselineRows) {
    const key=`${row?.code}|${row?.date}|${row?.horizon}`;
    if(index.has(key)) return blocked("DUPLICATE_BASELINE_KEY");
    index.set(key,row);
  }
  if(bundle.pairedRows.length!==bundle.baselineRows.length||
     bundle.experimentalRows.length!==bundle.baselineRows.length)
    return blocked("PAIRED_ROW_COUNT_MISMATCH");
  const experimentalIndex=new Map();
  for(const row of bundle.experimentalRows) {
    const key=`${row?.code}|${row?.date}|${row?.horizon}`;
    if(experimentalIndex.has(key)) return blocked("DUPLICATE_EXPERIMENT_KEY");
    experimentalIndex.set(key,row);
  }
  const pairedKeys=new Set();
  for(const row of bundle.pairedRows) {
    const key=`${row?.code}|${row?.date}|${row?.horizon}`;
    if(pairedKeys.has(key)) return blocked("DUPLICATE_PAIRED_KEY");
    pairedKeys.add(key);
    const b=index.get(key),e=experimentalIndex.get(key);
    if(!b||!e||!Number.isFinite(row?.baselineReturnPct)||
       !Number.isFinite(row?.experimentalReturnPct)||
       row.baselineReturnPct!==b.returnPct||row.experimentalReturnPct!==e.returnPct)
      return blocked("PAIRED_VALUES_NOT_DERIVED_FROM_SOURCE");
  }
  const sha=verification.actualSha256;
  const result=runForwardResearchExperimentPipeline({
    ...bundle,datasetSha256:sha,pairedDatasetSha256:sha,tradeDatasetSha256:sha,
    minPairedSamples,minDistinctDates,minDistinctCodes,minTrades,
  });
  return {...result,verification,independentlyPinnedHashRequired:true,
    note:"All diagnostics read one hash-verified bundle; a matching hash does not establish external price provenance, licensing, or that hypothetical trades correspond to predictions."};
}
