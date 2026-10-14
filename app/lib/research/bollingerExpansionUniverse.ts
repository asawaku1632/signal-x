import {SUPPORT_REBOUND_RESEARCH_BASKET} from "./supportReboundUniverse";
import {BB_BREAKOUT_BATCHES} from "./bollingerBreakoutBatches";

// Research universe is fixed BEFORE collecting any additional outcomes.
// Original 20 include 3762, which is outside the existing curated 100-stock list.
export const BB_EXPANSION_POLICY = "BB_BREAKOUT_100_EXT_V1" as const;
export const BB_EXPANSION_BASE = BB_BREAKOUT_BATCHES.flat();
// Exclude exactly one basket code to keep total at 100 (20 old + 80 new).
// This choice is frozen independently of any historical performance.
export const BB_EXPANSION_CODES = SUPPORT_REBOUND_RESEARCH_BASKET
  .filter(code=>!BB_EXPANSION_BASE.includes(code as typeof BB_EXPANSION_BASE[number]) && code!=="5253");
export const BB_EXPANSION_BATCHES = Array.from({length:16},(_,n)=>
  BB_EXPANSION_CODES.slice(n*5,n*5+5)) as readonly (readonly string[])[];
export type BbExpansionId=number;
export function getExpansionBatch(id:unknown):readonly string[]{
  if(typeof id!=="number"||!Number.isInteger(id)||id<4||id>19)
    throw Error("INVALID_EXPANSION_BATCH");
  if(!verifyExpansionBaskets())throw Error("EXPANSION_POLICY_INVALID");
  return BB_EXPANSION_BATCHES[id-4];
}
export function verifyExpansionBaskets(){
  const full=[...BB_EXPANSION_BASE,...BB_EXPANSION_CODES];
  return BB_EXPANSION_BASE.length===20&&BB_EXPANSION_CODES.length===80
    &&BB_EXPANSION_BATCHES.length===16
    &&BB_EXPANSION_BATCHES.every(batch=>batch.length===5)
    &&full.length===100&&new Set(full).size===100
    &&full.every(code=>/^[0-9]{4}$/.test(code));
}
