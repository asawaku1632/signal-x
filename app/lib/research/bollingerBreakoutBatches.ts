/** Frozen retrospective baskets: reproducible, deliberately curated, NOT random. */
export const BB_BATCH_POLICY = 'BB_BREAKOUT_BATCH20_V1' as const;
export const BB_BREAKOUT_BATCHES = [
  ['9984','3762','7203','8035','8306'],
  ['6758','6501','9983','8058','7974'],
  ['9432','6861','4502','9020','5401'],
  ['6098','9101','7011','8001','6367'],
] as const;
export type BbBatchId = 0|1|2|3;
export function chooseBbBreakoutBatch(batch:unknown):readonly string[] {
  if(typeof batch!=='number'||!Number.isInteger(batch)||batch<0||batch>3)
    throw new Error('INVALID_RESEARCH_BATCH');
  return BB_BREAKOUT_BATCHES[batch];
}
export function verifyBbBasket(){
  const all=BB_BREAKOUT_BATCHES.flat();
  return all.length===20 && new Set(all).size===20 &&
    all.every(code=>/^[0-9]{4}$/.test(code));
}
