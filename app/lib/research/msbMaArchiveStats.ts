/**
 * Read-only cumulative MSB/OB study. Pure computation, no DB/HTTP.
 * Different trading dates of a symbol may overlap; only one at a time counts.
 * Distinct stocks can still overlap: this is NOT a capital-constrained portfolio.
 */
import { SWING_SHADOW_VERSION } from "./msbMaSwing.ts";
import { VOLUME_SENSITIVITY_VERSION, VOLUME_THRESHOLDS, selectNonOverlappingSwing } from "./msbMaVolumeSensitivity.ts";
import { classifyMsbResearchCode } from "./msbResearchPresets.ts";

export type StoredMsbObservation = {
  detector_version: string; volume_version: string; code: string;
  signal_time: number | string; entry_time: number | string; exit_time: number | string;
  profit_yen_100: number; return_percent: number | string;
  volume_eligible: boolean; ob_eligible: boolean;
  breakout_ratio: number | string | null; retest_ratio: number | string | null;
};
type Entry = {
  code: string; signalTime: number; entryTime: number; exitTime: number;
  profit: number; ret: number; volume: boolean; ob: boolean;
  breakout: number | null; retest: number | null;
};
export type ResearchGroup = "ALL" | "DISCOVERY" | "ADDITIONAL" | "CUSTOM";
export type SimpleStat = {
  count: number; wins: number; winRate: number | null;
  averageYen100: number | null; sumYen100: number | null;
  worstYen100: number | null; averageReturn: number | null;
};
export type VolumeArchiveRow = {
  threshold: number; breakout: SimpleStat; retest: SimpleStat; both: SimpleStat;
};
export type GroupArchive = {
  group: ResearchGroup; totalObservations: number; obObservations: number;
  baseNonOverlapCount: number; obNonOverlapCount: number;
  base: SimpleStat; volume15: SimpleStat; ob: SimpleStat; all15: SimpleStat;
  thresholds: VolumeArchiveRow[];
};
export type MsbArchiveSummary = {
  uniqueObservations: number; uniqueCodesWithSignals: number;
  duplicateRowsDiscarded: number; invalidRowsDiscarded: number;
  groups: GroupArchive[];
};
const round = (x: number) => Math.round(x * 100) / 100;
const safeTime = (x: number | string) => {
  const n = Number(x);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const ratio = (v: number | string | null) => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};
function parse(r: StoredMsbObservation): Entry | null {
  const signalTime = safeTime(r.signal_time), entryTime = safeTime(r.entry_time), exitTime = safeTime(r.exit_time);
  const ret = Number(r.return_percent);
  if (r.detector_version !== SWING_SHADOW_VERSION || r.volume_version !== VOLUME_SENSITIVITY_VERSION ||
    !/^[0-9]{4}$/.test(r.code) || signalTime === null || entryTime === null || exitTime === null ||
    !(signalTime < entryTime && entryTime < exitTime) ||
    !Number.isSafeInteger(r.profit_yen_100) || !Number.isFinite(ret) || Math.abs(ret) > 100000 ||
    typeof r.volume_eligible !== "boolean" || typeof r.ob_eligible !== "boolean") return null;
  // Fail closed on invalid non-null volume rather than treat it as an unknown signal.
  if ((r.breakout_ratio !== null && ratio(r.breakout_ratio) === null) ||
      (r.retest_ratio !== null && ratio(r.retest_ratio) === null) ||
      (!r.ob_eligible && (r.breakout_ratio !== null || r.retest_ratio !== null))) return null;
  return {
    code: r.code, signalTime, entryTime, exitTime, profit: r.profit_yen_100,
    ret, volume: r.volume_eligible, ob: r.ob_eligible,
    breakout: ratio(r.breakout_ratio), retest: ratio(r.retest_ratio),
  };
}
function stat(rows: readonly Entry[]): SimpleStat {
  if (!rows.length) return { count:0, wins:0, winRate:null,
    averageYen100:null, sumYen100:null, worstYen100:null, averageReturn:null };
  const sum = rows.reduce((s,e)=>s+e.profit,0);
  const wins = rows.filter(e=>e.profit>0).length;
  return {
    count:rows.length,wins,winRate:round(100*wins/rows.length),
    averageYen100:Math.round(sum/rows.length),sumYen100:sum,
    worstYen100:Math.min(...rows.map(e=>e.profit)),
    averageReturn:round(rows.reduce((s,e)=>s+e.ret,0)/rows.length),
  };
}
function summarizeGroup(group: ResearchGroup, all: readonly Entry[]): GroupArchive {
  const source = group === "ALL" ? all : all.filter(e=>classifyMsbResearchCode(e.code)===group);
  const base = selectNonOverlappingSwing(source);
  const obRaw = source.filter(e=>e.ob);
  const ob = selectNonOverlappingSwing(obRaw);
  const eligible = (e:Entry, stage:"breakout"|"retest"|"both", threshold:number) =>
    threshold === 0 || (stage === "breakout" ? e.breakout !== null && e.breakout >= threshold :
      stage === "retest" ? e.retest !== null && e.retest >= threshold :
      e.breakout !== null && e.breakout >= threshold &&
      e.retest !== null && e.retest >= threshold);
  return {
    group, totalObservations:source.length, obObservations:obRaw.length,
    baseNonOverlapCount:base.length, obNonOverlapCount:ob.length,
    base:stat(base),volume15:stat(base.filter(e=>e.volume)),
    ob:stat(base.filter(e=>e.ob)),all15:stat(base.filter(e=>e.volume&&e.ob)),
    thresholds:VOLUME_THRESHOLDS.map(threshold=>({
      threshold,
      breakout:stat(ob.filter(e=>eligible(e,"breakout",threshold))),
      retest:stat(ob.filter(e=>eligible(e,"retest",threshold))),
      both:stat(ob.filter(e=>eligible(e,"both",threshold))),
    })),
  };
}
export function summarizeArchivedMsb(input: readonly StoredMsbObservation[]): MsbArchiveSummary {
  const unique = new Map<string,Entry>();
  let duplicateRowsDiscarded=0,invalidRowsDiscarded=0;
  for(const raw of input) {
    const row = parse(raw);
    if(!row) {invalidRowsDiscarded++;continue;}
    const key=row.code+":"+row.signalTime;
    if(unique.has(key)){duplicateRowsDiscarded++;continue;}
    unique.set(key,row);
  }
  const entries=[...unique.values()];
  const groups:ResearchGroup[]=["ALL","DISCOVERY","ADDITIONAL","CUSTOM"];
  return {
    uniqueObservations:entries.length,
    uniqueCodesWithSignals:new Set(entries.map(e=>e.code)).size,
    duplicateRowsDiscarded,invalidRowsDiscarded,
    groups:groups.map(g=>summarizeGroup(g,entries)),
  };
}
