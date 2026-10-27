import { compareForwardExperimentOutcomes } from "./dailyForwardExperimentComparison.mjs";
import { assessForwardExperimentUncertainty } from "./dailyForwardExperimentUncertainty.mjs";
import { assessForwardExperimentRisk } from "./dailyForwardExperimentRisk.mjs";
import { triageForwardExperimentEvidence } from "./dailyForwardExperimentTriage.mjs";

/**
 * Offline integration. The risk series is separately supplied, so its provenance
 * must be independently linked to the same experiment before any human reliance.
 */
export function runForwardResearchExperimentPipeline({
  plan,baselineRows,experimentalRows,pairedRows,hypotheticalTrades,
  datasetSha256,pairedDatasetSha256,tradeDatasetSha256,
  minPairedSamples=100,minDistinctDates=20,minDistinctCodes=20,minTrades=30,
}={}) {
  const validHash=(h)=>typeof h==="string"&&/^[a-f0-9]{64}$/i.test(h);
  const sameDataset=validHash(datasetSha256)&&validHash(pairedDatasetSha256)&&
    validHash(tradeDatasetSha256)&&
    datasetSha256.toLowerCase()===pairedDatasetSha256.toLowerCase()&&
    datasetSha256.toLowerCase()===tradeDatasetSha256.toLowerCase();
  if(!sameDataset) return {status:"BLOCKED",reasons:["DATASET_PROVENANCE_NOT_LINKED"],
    improvementProven:false,autoApply:false,productionWrites:false};
  const comparison=compareForwardExperimentOutcomes(plan,baselineRows,experimentalRows,{minPairedSamples});
  const uncertainty=assessForwardExperimentUncertainty(pairedRows,{minDistinctDates,minDistinctCodes});
  const risk=assessForwardExperimentRisk(hypotheticalTrades,{minTrades});
  const triage=triageForwardExperimentEvidence({comparison,uncertainty,risk});
  return {status:triage.status,reasons:triage.reasons,
    datasetSha256:datasetSha256.toLowerCase(),
    comparison,uncertainty,risk,triage,
    improvementProven:false,autoApply:false,productionWrites:false,productionApproval:false,
    note:"Caller-provided matching hashes are metadata claims, not cryptographic verification of the three arrays. Independent dataset binding and price/license review remain required.",
  };
}
