/**
 * SHADOW-ONLY: SMA75 breakout versus first post-breakout support retest.
 * Pure, offline analysis. No network, database, live signal or notification access.
 * Input must be completed, chronological daily OHLCV bars for one frozen cohort.
 */
export const MA75_STUDY_VERSION = 'ma75_breakout_retest_shadow_v1';
export const MA75_RULES = Object.freeze({
  period: 75, retestWindow: 10, retestTouchBuffer: 0.01,
  frictionPerSide: 0.001, shareLot: 100, budgetMin: 100000, budgetMax: 500000,
});

const finite = x => typeof x === 'number' && Number.isFinite(x);
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const round = (x, n = 4) => Number(x.toFixed(n));
const median = xs => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length/2);
  return round(sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2);
};
function checkBars(bars) {
  if (!Array.isArray(bars) || bars.length < 76) return 'INSUFFICIENT_BARS';
  for (let i=0; i<bars.length; i++) {
    const b = bars[i];
    if (!b || !Number.isSafeInteger(b.time) || b.time<=0 ||
        ![b.open,b.high,b.low,b.close,b.volume].every(finite) ||
        b.open<=0 || b.high<=0 || b.low<=0 || b.close<=0 || b.volume<0 ||
        b.high < Math.max(b.open,b.close,b.low) ||
        b.low > Math.min(b.open,b.close,b.high)) return 'INVALID_OHLCV';
    if (i>0 && b.time<=bars[i-1].time) return 'DUPLICATE_OR_UNSORTED';
    if (i>0 && Math.abs(b.close/bars[i-1].close-1)>0.45)
      return 'SPLIT_OR_EXTREME_GAP_REVIEW';
  }
  return null;
}
const sma = (bars, i, n) => i<n-1 ? null : mean(bars.slice(i-n+1,i+1).map(x=>x.close));
const volumeRatio = (bars, i) => {
  if (i<20) return null;
  const prior=bars.slice(i-20,i).map(x=>x.volume);
  if (prior.some(v=>v<=0) || bars[i].volume<=0) return null;
  return bars[i].volume/mean(prior);
};
function summarize(kind, entries) {
  const complete=entries.filter(e=>e.return5Percent!==null);
  const values=complete.map(e=>e.return5Percent);
  const pnl=complete.map(e=>e.profit5Yen100);
  const budget=complete.filter(e=>e.budgetEligible);
  const win=values.filter(v=>v>0).length;
  return {
    kind, signals:entries.length, completed:complete.length,
    pending:entries.length-complete.length, distinctCodes:new Set(entries.map(e=>e.code)).size,
    winRatePercent:values.length ? round(win/values.length*100,2) : null,
    averageReturn5Percent:values.length ? round(mean(values)) : null,
    medianReturn5Percent:median(values),
    averageProfit5Yen100:pnl.length ? round(mean(pnl),0) : null,
    averageMaxAdversePercent:complete.length ? round(mean(complete.map(e=>e.maxAdverse5Percent))) : null,
    worstReturn5Percent:values.length ? round(Math.min(...values)) : null,
    budgetCompleted:budget.length,
    budgetWinRatePercent:budget.length ? round(budget.filter(e=>e.return5Percent>0).length/budget.length*100,2) : null,
    budgetAverageReturn5Percent:budget.length ? round(mean(budget.map(e=>e.return5Percent))) : null,
  };
}
/**
 * Signal is after completed close i, hypothetical entry next OPEN, exits at
 * closes i+3/i+5. A complete outcome exists only with all required future bars.
 * Signal features use bars <= i, outcomes use future bars only after classification.
 */
function observation(kind, code, bars, i, breakoutIndex) {
  const ma=sma(bars,i,75);
  const prior=sma(bars,i-1,75);
  const entryBar=bars[i+1];
  const entry=entryBar ? entryBar.open*(1+MA75_RULES.frictionPerSide) : null;
  const e3=bars[i+3],e5=bars[i+5];
  const ret3=entry && e3 ? (e3.close*(1-MA75_RULES.frictionPerSide)/entry-1)*100 : null;
  const ret5=entry && e5 ? (e5.close*(1-MA75_RULES.frictionPerSide)/entry-1)*100 : null;
  const lows=entry && e5 ? bars.slice(i+1,i+6).map(x=>x.low) : [];
  const volRatio=volumeRatio(bars,i);
  return {
    kind,code,signalIndex:i,signalTime:bars[i].time,breakoutIndex,
    ma75:round(ma),ma75Rising:ma>prior,
    volumeRatio:volRatio===null ? null : round(volRatio),
    signalClose:bars[i].close,
    entryTime:entryBar?.time??null,
    entryPrice:entry===null ? null : round(entry),
    budgetEligible:entry!==null && entry*MA75_RULES.shareLot >= MA75_RULES.budgetMin &&
      entry*MA75_RULES.shareLot <= MA75_RULES.budgetMax,
    exit5Time:e5?.time??null,
    return3Percent:ret3===null?null:round(ret3),
    return5Percent:ret5===null?null:round(ret5),
    profit5Yen100:ret5===null?null:Math.round((e5.close*(1-MA75_RULES.frictionPerSide)-entry)*MA75_RULES.shareLot),
    maxAdverse5Percent:lows.length ? round((Math.min(...lows)/entry-1)*100) : null,
  };
}
function pairedSummary(observations) {
  const lookup=new Map(observations.filter(x=>x.kind==='BREAKOUT')
    .map(x=>[x.code+':'+x.signalIndex,x]));
  const pairs=observations.filter(x=>x.kind==='RETEST').flatMap(r=>{
    const b=lookup.get(r.code+':'+r.breakoutIndex);
    return b?.return5Percent!==null && r.return5Percent!==null
      ? [{code:r.code,breakout:b,retest:r}] : [];
  });
  const wins=(key)=>round(100*pairs.filter(p=>p[key].return5Percent>0).length/pairs.length,2);
  return {
    pairedEvents:pairs.length,
    pairedCodes:new Set(pairs.map(p=>p.code)).size,
    breakoutAverage5Percent:pairs.length?round(mean(pairs.map(p=>p.breakout.return5Percent))):null,
    retestAverage5Percent:pairs.length?round(mean(pairs.map(p=>p.retest.return5Percent))):null,
    averageRetestMinusBreakoutPercent:pairs.length?round(mean(pairs.map(p=>p.retest.return5Percent-p.breakout.return5Percent))):null,
    breakoutWinRatePercent:pairs.length?wins('breakout'):null,
    retestWinRatePercent:pairs.length?wins('retest'):null,
    retestOutperformedPercent:pairs.length?round(100*pairs.filter(p=>p.retest.return5Percent>p.breakout.return5Percent).length/pairs.length,2):null,
    bothBudgetEligible:pairs.filter(p=>p.breakout.budgetEligible && p.retest.budgetEligible).length,
  };
}
/** Multiple signals from the same code can overlap; stats are descriptive, not independent trials. */
export function studyMa75BreakoutRetest(cohorts) {
  const observations=[];
  const excluded=[];
  const seen=new Set();
  let accepted=0, totalBars=0;
  for (const cohort of cohorts) {
    const {code,candles:bars}=cohort;
    if (typeof code!=='string' || !/^[0-9]{3}[0-9A-Z]$/.test(code)) {
      excluded.push({code:String(code),reason:'INVALID_CODE'}); continue;
    }
    if (seen.has(code)) {excluded.push({code,reason:'DUPLICATE_COHORT'}); continue;}
    seen.add(code);
    if (cohort.timeframe!=='1D') {excluded.push({code,reason:'NOT_DAILY'}); continue;}
    const invalid=checkBars(bars);
    if (invalid) {excluded.push({code,reason:invalid}); continue;}
    accepted++;totalBars+=bars.length;
    for(let i=75;i<bars.length;i++) {
      const today=sma(bars,i,75),yesterday=sma(bars,i-1,75);
      if (!(bars[i].close>today && bars[i-1].close<=yesterday)) continue;
      observations.push(observation('BREAKOUT',code,bars,i,i));
      for(let j=i+1;j<Math.min(bars.length,i+11);j++) {
        const support=sma(bars,j,75);
        const bar=bars[j];
        // A daily CLOSE below SMA75 before the retest invalidates that setup.
        if (bar.low<=support*(1+MA75_RULES.retestTouchBuffer) &&
            bar.close>=support && bar.close>=bar.open) {
          observations.push(observation('RETEST',code,bars,j,i));
          break;
        }
        if (bar.close<support) break;
      }
    }
  }
  observations.sort((a,b)=>a.signalTime-b.signalTime || a.code.localeCompare(b.code) || a.kind.localeCompare(b.kind));
  return {
    version:MA75_STUDY_VERSION,acceptedCohorts:accepted,totalBars,excluded,
    stats:['BREAKOUT','RETEST'].map(kind=>summarize(kind,observations.filter(o=>o.kind===kind))),
    paired:pairedSummary(observations),
    observations,
    warnings:[
      'Convenience sample; snapshot-stock selection bias is not controlled.',
      'Overlapping same-stock events are correlated; no p-value or causal inference.',
      '45% single-close discontinuities are quarantined pending split/adjustment review.',
      'No tax, commission, short-sale, borrow, dividends or full execution modelling.',
      'Never use these retrospective results for AI POWER scoring or notifications without held-out forward validation.',
    ],
  };
}
