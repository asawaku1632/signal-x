// Research-only JPX cash-equity calendar, 2026. Based on the JPX official
// market holidays list: https://www.jpx.co.jp/english/corporate/about-jpx/calendar/
// Never apply to futures/derivatives, which have different holiday sessions.
// Reject years outside this audited static calendar; no inferred holiday rules.
const HOLIDAYS_2026 = new Set([
  '2026-01-01','2026-01-02','2026-01-12','2026-02-11',
  '2026-02-23','2026-03-20','2026-04-29','2026-05-04',
  '2026-05-05','2026-05-06','2026-07-20','2026-08-11',
  '2026-09-21','2026-09-22','2026-09-23','2026-10-12',
  '2026-11-03','2026-11-23','2026-12-31'
]);
export function nextFiveJpxEquitySessions(tradeDate) {
  if(typeof tradeDate !== 'string' || !/^2026-\d{2}-\d{2}$/.test(tradeDate)) return null;
  const start=Date.parse(tradeDate+'T00:00:00Z');
  if(!Number.isFinite(start) || new Date(start).toISOString().slice(0,10)!==tradeDate) return null;
  const sessions=[];
  for(let offset=1;offset<=20 && sessions.length<5;offset++){
    const day=new Date(start+offset*86400000);
    const iso=day.toISOString().slice(0,10);
    if(!iso.startsWith('2026-')) return null;
    if(day.getUTCDay()!==0 && day.getUTCDay()!==6 && !HOLIDAYS_2026.has(iso)) sessions.push(iso);
  }
  return sessions.length===5?sessions:null;
}
