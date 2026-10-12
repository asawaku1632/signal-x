import type { ScoredHint, ScoreMetrics, ScoreFeature } from "./supportReboundRiskScore.ts";
import { inReboundRiskPhase } from "./supportReboundRiskStudy.ts";
import type { RiskPhase } from "./supportReboundRiskStudy.ts";

/**
 * Exploratory explanations for MID(30-59) score. V1 cutoffs and pairs are fixed.
 * We never choose the "best" pair to act on; compare association, not causality.
 */
export const MID_RISK_FACTORS = [
  { id: "NEGATIVE_SLOPE", label: "50日線が下向き" },
  { id: "HIGH_ATR", label: "ATRが3%以上" },
  { id: "LOW_RSI", label: "RSIが40未満" },
  { id: "THIN_VOLUME", label: "出来高比0.7未満" },
  { id: "LOWER_BB", label: "BB下限割れ" },
] as const;
export type MidFactorId = typeof MID_RISK_FACTORS[number]["id"];
export type MidMetrics = ScoreMetrics & { moderateLossCount: number };
export type MidRiskPattern = {
  id: string; label: string; group: "SINGLE" | "PAIR";
  metrics: MidMetrics; warning: string | null;
};
export type MidRiskAnalysis = {
  phase: RiskPhase; total: MidMetrics; factors: MidRiskPattern[];
  topLosses: Array<{ code: string; signalTime: number; returnPercent: number; matched: string[] }>;
  unknown: number;
};
const round = (n: number) => Number(n.toFixed(2));
export function factorFlags(f: ScoreFeature): Record<MidFactorId, boolean> {
  return {
    NEGATIVE_SLOPE: f.sma50Slope10Percent < 0,
    HIGH_ATR: f.atr14Percent >= 3,
    LOW_RSI: f.rsi14 < 40,
    THIN_VOLUME: f.volumeRatio20 < 0.7,
    LOWER_BB: f.bbLowerGapPercent < 0,
  };
}
function calc(items: ScoredHint[]): MidMetrics {
  const n=items.length;const trades=items.map(x=>x.trade!).filter(Boolean);
  const wins=trades.filter(t=>t.pnlYen>0).length;
  const losses=trades.filter(t=>t.returnPercent<=-5).length;
  const sum=(key:"returnPercent"|"worstIntratradePercent")=>trades.reduce((a,t)=>a+t[key],0);
  return {
    count:n,wins,bigLosses:losses,moderateLossCount:trades.filter(t=>t.returnPercent<0&&t.returnPercent>-5).length,
    bigLossPercent:n?round(100*losses/n):null,
    winPercent:n?round(100*wins/n):null,avgPercent:n?round(sum("returnPercent")/n):null,
    worstPercent:n?Math.min(...trades.map(t=>t.returnPercent)):null,
    avgDrawdownPercent:n?round(sum("worstIntratradePercent")/n):null,
  };
}
export function analyzeMidRisk(items: ScoredHint[], phase: RiskPhase): MidRiskAnalysis {
  const phaseRows=items.filter(x=>x.trade&&inReboundRiskPhase(x.trade,phase));
  const mid=phaseRows.filter((x): x is ScoredHint & { features: ScoreFeature }=>
    x.band==="MID"&&x.score!==null&&x.features!==null);
  const factorPairs: Array<{ id: string; label: string; ids: MidFactorId[]; group: "SINGLE"|"PAIR" }>=
    MID_RISK_FACTORS.map(x=>({id:x.id,label:x.label,ids:[x.id],group:"SINGLE"}));
  for(let i=0;i<MID_RISK_FACTORS.length;i++)for(let j=i+1;j<MID_RISK_FACTORS.length;j++){
    const a=MID_RISK_FACTORS[i],b=MID_RISK_FACTORS[j];
    factorPairs.push({id:a.id+"+"+b.id,label:a.label+" ＋ "+b.label,ids:[a.id,b.id],group:"PAIR"});
  }
  return {
    phase,total:calc(mid),unknown:phaseRows.filter(x=>x.score===null||x.features===null).length,
    factors:factorPairs.map(x=>{
      const values=mid.filter(item=>x.ids.every(id=>factorFlags(item.features)[id]));
      return {...x,metrics:calc(values),
        warning:values.length<20?"少数例：参考値":null};
    }),
    topLosses:mid.filter(x=>x.trade!.returnPercent<=-5)
      .sort((a,b)=>a.trade!.returnPercent-b.trade!.returnPercent)
      .slice(0,12).map(x=>({
        code:x.code,signalTime:x.hintTime,returnPercent:x.trade!.returnPercent,
        matched:MID_RISK_FACTORS.filter(t=>factorFlags(x.features)[t.id]).map(t=>t.label),
      })),
  };
}
