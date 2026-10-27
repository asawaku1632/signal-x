import { inspectForwardResearchExport } from "./dailyForwardResearchExportReadiness.mjs";

/**
 * Explicit offline adapter for a pre-exported snapshot. Never fetches Supabase.
 * Unknown price origins, licensing, or future outcomes are NOT verified.
 */
export function prepareForwardResearchSnapshotExport(snapshot,{source="OFFLINE_SNAPSHOT"}={}) {
  if(!Array.isArray(snapshot)) return {
    status:"BLOCKED",rows:[],diagnostic:inspectForwardResearchExport(null),
    autoApply:false,productionWrites:false,
  };
  const rows=snapshot.map((r)=>{
    const code=typeof r?.code==="string"?r.code:typeof r?.stock_code==="string"?r.stock_code:"";
    const date=typeof r?.date==="string"?r.date:typeof r?.session_date==="string"?r.session_date:"";
    const horizon=Number.isInteger(r?.horizon)?r.horizon:null;
    const priceBasisVerified=r?.priceBasisVerified===true&&r?.priceEvidenceReviewed===true;
    const licenseReview=r?.licenseReview==="VERIFIED"&&r?.licenseEvidenceReviewed===true?"VERIFIED":"NOT_VERIFIED";
    const verifiedOutcome=r?.status==="VERIFIED"&&priceBasisVerified&&Number.isFinite(r?.returnPct);
    return {code,date,horizon,status:verifiedOutcome?"VERIFIED":"NOT_VERIFIED",
      priceBasisVerified,returnPct:verifiedOutcome?r.returnPct:null,
      licenseReview,provider:typeof r?.provider==="string"?r.provider:"",
      sourceRecordId:typeof r?.sourceRecordId==="string"?r.sourceRecordId:"",
      modelVersion:typeof r?.modelVersion==="string"?r.modelVersion:"",
    };
  });
  const diagnostic=inspectForwardResearchExport(rows,{source});
  return {status:diagnostic.status,rows,diagnostic,
    autoApply:false,productionWrites:false,productionApproval:false,
    note:"Only an in-memory export adapter; reviewed flags are caller claims, not independently verified external evidence.",
  };
}
