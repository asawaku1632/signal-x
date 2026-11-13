// Research-only deterministic daily earnings event evaluator. No network or DB writes.
export function firstPostReleaseSession(releasedAtJst, sessions) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(releasedAtJst)) throw Error('JST timestamp required');
  const releaseMs=Date.parse(releasedAtJst);
  if (!Number.isFinite(releaseMs)) throw Error('Invalid release timestamp');
  const sorted=[...sessions].sort();
  if (new Set(sorted).size!==sorted.length || sorted.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d))) throw Error('Invalid sessions');
  // v1: exclude announcements during regular session (09:00-15:30 JST).
  const day=releasedAtJst.slice(0,10),clock=releasedAtJst.slice(11,16);
  if (clock>='09:00' && clock<'15:30' && sorted.includes(day)) return {status:'INTRADAY_EXCLUDED',eventDate:null};
  const eventDate=sorted.find(d=>d>day || (d===day && clock<'09:00'))??null;
  return {status:eventDate?'OK':'NO_SESSION',eventDate};
}
export function evaluateDailyEvent({eventDate, bars, horizons=[1,2,3,5,10,20]}) {
  if (!Array.isArray(bars)||!bars.length) throw Error('Missing bars');
  const sorted=[...bars].sort((a,b)=>a.date.localeCompare(b.date));
  if (new Set(sorted.map(x=>x.date)).size!==sorted.length) throw Error('Duplicate dates');
  if(sorted.some(b=>!/^\\d{4}-\\d{2}-\\d{2}$/.test(b.date||''))) throw Error('Invalid bar date');
  const i=sorted.findIndex(x=>x.date===eventDate);
  if(i<0) return {status:'MISSING_EVENT_BAR',outcomes:[]};
  const base=Number(sorted[i].adjClose);
  if(!Number.isFinite(base)||base<=0) throw Error('Invalid base close');
  const outcomes=horizons.map(h=>{
    if(!Number.isInteger(h)||h<1) throw Error('Invalid horizon');
    const bar=sorted[i+h];
    const end=bar?.adjClose===null||bar?.adjClose===undefined||bar?.adjClose===''?NaN:Number(bar.adjClose);
    return {horizon:h,status:bar&&Number.isFinite(end)&&end>0?'MATURED':'PENDING',returnPct:bar&&Number.isFinite(end)&&end>0?100*(end/base-1):null,endDate:bar?.date??null};
  });
  return {status:'OK',eventDate,base,outcomes};
}
