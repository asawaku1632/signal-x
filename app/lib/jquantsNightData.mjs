export function jquantsCode(value) {
  if(typeof value!=="string")return null;
  const code=value.length===5&&value.endsWith("0")?value.slice(0,4):value;
  return /^[0-9][0-9A-Z][0-9][0-9A-Z]$/.test(code)?code:null;
}
export function jquantsDailyCandle(row, expectedDate) {
  if(!row||typeof row!=="object"||!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)||!Number.isFinite(Date.parse(expectedDate+"T15:30:00+09:00")))return null;
  if(row.Date!==expectedDate||!jquantsCode(row.Code))return null;
  const values=[row.AdjO,row.AdjH,row.AdjL,row.AdjC,row.AdjVo];
  if(values.some(value=>typeof value!=="number"||!Number.isFinite(value)))return null;
  const [open,high,low,close,volume]=values;
  if(open<=0||low<=0||close<=0||volume<0||high<Math.max(open,close,low)||low>Math.min(open,close))return null;
  return {time:Date.parse(expectedDate+"T15:30:00+09:00")/1000,open,high,low,close,volume};
}
