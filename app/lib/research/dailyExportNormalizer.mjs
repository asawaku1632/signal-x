/** Pure normalization of approved SQL export rows. Never elevates evidence flags. */
const numeric=x=>typeof x==="number"&&Number.isFinite(x)?x:typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):null;
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;
export function normalizeDailyExportRows(rows){
 if(!Array.isArray(rows))throw Error("INVALID_EXPORT_ROWS");
 return rows.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row))return null;
  return {date:date(row.date),code:row.code,price:numeric(row.price),
   nextPrice:numeric(row.next_price),priorDate:date(row.prior_date),
   priorScore:numeric(row.prior_score),sourceDate:date(row.source_date),
   sourcePrice:numeric(row.source_price),
   sourceSnapshotCreatedAt:typeof row.source_snapshot_created_at==="string"?row.source_snapshot_created_at:null,
   priorAvailableAt:null,priorEvidenceVerified:false,
   outcomeProvenanceVerified:false};
 });
}
