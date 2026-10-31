import assert from "node:assert/strict";
import test from "node:test";

const VALID_CODE = /^[0-9A-Z]{4,5}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:0[9]|1[0-5]):[0-5]\d$/;

/**
 * Pure, read-only audit of J-Quants v2 minute bars.
 * The provider's Date+Time is a bar label, not proof that it was available
 * to a historical SIGNALX decision at that instant.
 */
export function auditJQuantsMinuteBars(payload: unknown, expectedDate: string) {
  const problems: string[] = [];
  if (!DATE.test(expectedDate) || !Number.isFinite(Date.parse(expectedDate + "T00:00:00Z"))) {
    throw new Error("Invalid expectedDate");
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as {data?:unknown}).data)) {
    return { valid: false, rows: 0, problems: ["Missing data array"] };
  }
  const rows = (payload as {data:unknown[]}).data;
  const keys = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string,unknown>;
    if (!r || typeof r !== "object") { problems.push(`row ${i}: invalid object`); continue; }
    if (r.Date !== expectedDate || !DATE.test(String(r.Date))) problems.push(`row ${i}: date mismatch`);
    if (typeof r.Time !== "string" || !TIME.test(r.Time)) problems.push(`row ${i}: invalid time`);
    if (typeof r.Code !== "string" || !VALID_CODE.test(r.Code)) problems.push(`row ${i}: invalid code`);
    const values = ["O","H","L","C","Vo","Va"].map(k=>r[k]);
    if (!values.every(v=>typeof v==="number" && Number.isFinite(v))) {
      problems.push(`row ${i}: nonnumeric OHLCV`); continue;
    }
    const [o,h,l,c,vol,val] = values as number[];
    if (o<=0 || h<=0 || l<=0 || c<=0 || l>Math.min(o,c) || h<Math.max(o,c) || h<l || vol<0 || val<0) {
      problems.push(`row ${i}: inconsistent OHLCV`);
    }
    const key=`${r.Date}/${r.Time}/${r.Code}`;
    if (keys.has(key)) problems.push(`row ${i}: duplicate minute`);
    keys.add(key);
  }
  return { valid: problems.length===0, rows: rows.length, problems };
}
