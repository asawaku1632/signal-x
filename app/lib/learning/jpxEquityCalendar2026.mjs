// Research-only JPX cash-equity calendar: official scheduled closures in 2026/2027.
// Source: https://www.jpx.co.jp/english/corporate/about-jpx/calendar/
// No futures holiday trading, unscheduled market closures or inferred future years.
const HOLIDAYS = new Set([
  '2026-01-01','2026-01-02','2026-01-12','2026-02-11',
  '2026-02-23','2026-03-20','2026-04-29','2026-05-04',
  '2026-05-05','2026-05-06','2026-07-20','2026-08-11',
  '2026-09-21','2026-09-22','2026-09-23','2026-10-12',
  '2026-11-03','2026-11-23','2026-12-31',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23',
  '2027-03-22','2027-04-29','2027-05-03','2027-05-04',
  '2027-05-05','2027-07-19','2027-08-11','2027-09-20',
  '2027-09-23','2027-10-11','2027-11-03','2027-11-23',
  '2027-12-31'
]);
const validDate = day => typeof day === 'string' && /^202[67]-\d{2}-\d{2}$/.test(day)
  && Number.isFinite(Date.parse(day+'T00:00:00Z'))
  && new Date(day+'T00:00:00Z').toISOString().slice(0,10) === day;
function isSession(day) {
  if (!validDate(day)) return false;
  const dow=new Date(day+'T00:00:00Z').getUTCDay();
  return dow!==0 && dow!==6 && !HOLIDAYS.has(day)
    && !day.endsWith('-01-02') && !day.endsWith('-01-03');
}
export function nextFiveJpxEquitySessions(tradeDate) {
  // Do not infer outcomes from non-trading prediction dates.
  if(!isSession(tradeDate)) return null;
  const start=Date.parse(tradeDate+'T00:00:00Z');
  const sessions=[];
  for(let offset=1;offset<=20 && sessions.length<5;offset++){
    const iso=new Date(start+offset*86400000).toISOString().slice(0,10);
    if(!validDate(iso)) return null;
    if(isSession(iso)) sessions.push(iso);
  }
  return sessions.length===5?sessions:null;
}
