export const BB_AUDIT_BATCH_SIZE = 25;
export const BB_AUDIT_EXPECTED_TOTAL = 419;

export function getBbAuditBatch(total: number, batch: number) {
  if (total !== BB_AUDIT_EXPECTED_TOTAL) throw new Error('RESEARCH_COHORT_CHANGED');
  if (!Number.isInteger(batch) || batch < 0 || batch >= Math.ceil(total / BB_AUDIT_BATCH_SIZE)) throw new Error('INVALID_BATCH');
  return { limit: BB_AUDIT_BATCH_SIZE, offset: batch * BB_AUDIT_BATCH_SIZE, expected: Math.min(BB_AUDIT_BATCH_SIZE, total - batch * BB_AUDIT_BATCH_SIZE) };
}

export function summarizeBbAudit(results: {result:string; difference:number|null}[]) {
  return {
    compared: results.filter(x => x.result === 'COMPARED_UNVERIFIED_BASIS').length,
    matched: results.filter(x => x.result === 'COMPARED_UNVERIFIED_BASIS' && x.difference === 0).length,
    differed: results.filter(x => x.result === 'COMPARED_UNVERIFIED_BASIS' && x.difference !== 0).length,
    unavailable: results.filter(x => x.result !== 'COMPARED_UNVERIFIED_BASIS').length,
  };
}
