/** Four-character JPX equity codes have allowed letters in positions 2/4.
 * In 2026 they include 590A, 641A and 642A. Do not silently discard them.
 * JPX SICC: https://www.jpx.co.jp/sicc/code-pr/
 */
export const JPX_STOCK_CODE_RE=/^[1-9][0-9ACDFGHJKLMNPRSTUWXY][0-9][0-9ACDFGHJKLMNPRSTUWXY]$/;
export function isJpxStockCode(value){
  return typeof value==="string"&&JPX_STOCK_CODE_RE.test(value);
}
export function fromJquantsFiveCharacterCode(value){
  if(typeof value!=="string")return null;
  if(isJpxStockCode(value))return value;
  if(value.length===5&&value.endsWith("0")&&isJpxStockCode(value.slice(0,4)))
    return value.slice(0,4);
  return null;
}
