import { createHash } from "node:crypto";

export const MSB_SCALE_POLICY_VERSION = "MSB_EXTRA_FIVE_V1";
export const MSB_SCALE_MAX_EXTRA_BATCHES = 9;
export const MSB_SCALE_BATCH_SIZE = 5;
export const MSB_SCALE_MAX_TOTAL_STOCKS = 50;
/** Shares the existing first five candles. Never changes the horizontal batch. */
export function chooseMsbUnseenStocks(args: {
  universe: readonly string[]; covered: ReadonlySet<string>; extraBatches: number;
}): string[] {
  const {universe,covered,extraBatches}=args;
  if(!Number.isInteger(extraBatches)||extraBatches<0||extraBatches>MSB_SCALE_MAX_EXTRA_BATCHES)
    return [];
  const take=extraBatches*MSB_SCALE_BATCH_SIZE;
  return [...new Set(universe)]
    .filter(code=>/^[0-9]{4}$/.test(code)&&!covered.has(code))
    .map(code=>({code,rank:createHash("sha256").update(MSB_SCALE_POLICY_VERSION+":"+code).digest("hex")}))
    .sort((a,b)=>a.rank.localeCompare(b.rank)||a.code.localeCompare(b.code))
    .slice(0,take).map(x=>x.code);
}
