/** Normalize PostgreSQL timestamptz display into explicit-offset ISO.
 * Offline-only adapter. Rejects naive timestamps and unknown offsets.
 */
export function normalizePgTimestamp(x){
 if(typeof x!=="string")return null;
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x))
  return Number.isFinite(Date.parse(x))?x:null;
 const m=/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)([+-]\d\d)(?::?(\d\d))?$/.exec(x);
 if(!m)return null;
 const iso=m[1]+"T"+m[2]+m[3]+":"+(m[4]??"00");
 return Number.isFinite(Date.parse(iso))?iso:null;
}
export function adaptPreopenDbRows(rows){
 if(!Array.isArray(rows))throw Error("INVALID_PREOPEN_DB_ROWS");
 return rows.map(r=>({tradeDate:r?.trade_date??null,capturedAt:normalizePgTimestamp(r?.captured_at),quotes:r?.quotes??null}));
}
