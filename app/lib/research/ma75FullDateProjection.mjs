/**
 * SHADOW ONLY: validate and project genuine date-query, all-listed provider
 * page envelopes to the original frozen research cohort without pretending
 * that excluded securities are missing or invalid. No I/O or credentials.
 *
 * Official J-Quants date-only daily query returns ALL listed stock issues,
 * not just application-selected frozen symbols. Preserve the source row count.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {parseMa75JQuantsDailyPages} from './ma75JQuantsDailyPages.mjs';
export const MA75_FULL_DATE_PROJECTION_VERSION='ma75_full_date_projection_v1';
const CODE=/^[0-9]{3}[0-9A-Z](?:[0-9])?$/;
const realDate=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const ordinary=x=>x.length===4?x:(x.endsWith('0')?x.slice(0,4):null);

/**
 * Never discard a malformed/wrong-date provider row just to make coverage look
 * complete. Extra valid unrelated listings may be excluded only after their
 * original source code and trade date have been independently inspected.
 */
export function projectMa75FullDateSource(freeze,{date,pages}={}){
 validateMa75FrozenUniverse(freeze);
 if(!realDate(date)||!Array.isArray(pages)||pages.length===0||pages.length>50)
  throw new TypeError('NEED_ONE_FULL_MARKET_DATE_RESPONSE');
 const frozen=new Set(freeze.codes),seenFullCodes=new Set(),seenFrozen=new Set();
 const selectedPages=[],unselectedCodes=new Set();
 let originalRows=0,selectedRows=0,unselectedRows=0;
 for(const p of pages){
  if(!p||!Array.isArray(p.response?.data)||p.response.data.length>10000)
   throw new TypeError('INVALID_DATE_QUERY_PAGE');
  const selected=[];
  for(const row of p.response.data){
   originalRows++;
   const c=row?.Code;
   if(typeof c!=='string'||!CODE.test(c)||row?.Date!==date||seenFullCodes.has(c))
    throw new TypeError('ORIGINAL_SOURCE_CODE_DATE_OR_DUPLICATE_INVALID');
   seenFullCodes.add(c);
   const common=ordinary(c);
   if(common!==null&&frozen.has(common)){
    if(seenFrozen.has(common))
     throw new TypeError('DUPLICATE_FROZEN_ORDINARY_SHARE_CLASS');
    seenFrozen.add(common);selected.push(row);selectedRows++;
   }else{
    unselectedCodes.add(c);unselectedRows++;
   }
  }
  selectedPages.push({
   requestPaginationKey:p.requestPaginationKey,
   receivedAt:p.receivedAt,
   response:{data:selected,...(Object.prototype.hasOwnProperty.call(p.response,'pagination_key')?
    {pagination_key:p.response.pagination_key}:{})},
  });
 }
 // The parser still checks every original page link and last continuation.
 const audit=parseMa75JQuantsDailyPages(freeze,{
  date,pages:selectedPages,requestedCode:null
 });
 if(audit.rawProviderRows!==selectedRows||
    audit.outsideFrozenCodes.length!==0||audit.unmappedRows.length!==0||
    selectedRows+unselectedRows!==originalRows)
  throw new TypeError('DERIVED_FROZEN_PROJECTION_NOT_RECONCILABLE');
 return {
  version:MA75_FULL_DATE_PROJECTION_VERSION,date,
  originalAllListedRows:originalRows,
  projectedFrozenRows:selectedRows,
  excludedUnselectedListingRows:unselectedRows,
  uniqueUnselectedListingCodes:unselectedCodes.size,
  originalEnvelopeSourceAuthenticated:false,
  originalResponseWasModified:false,
  projectionIsNotRawAllListedResponse:true,
  completeProviderPagination:audit.paginationComplete,
  audit
 };
}
