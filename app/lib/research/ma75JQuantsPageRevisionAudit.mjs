/**
 * SHADOW ONLY. Compare two separately archived J-Quants v2 daily
 * page-parse results for the SAME frozen population and date.
 * A data revision is explicitly investigated, never backfilled into
 * original point-in-time features. This is not proof of source licensing
 * or cryptographically authenticated timestamps.
 */
import {createHash} from 'node:crypto';
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {MA75_JQUANTS_PAGE_VERSION} from './ma75JQuantsDailyPages.mjs';

export const MA75_PAGE_REVISION_VERSION='ma75_jquants_daily_revision_audit_v2';
export function fingerprintMa75RevisionPopulation(freeze) {
 validateMa75FrozenUniverse(freeze);
 return createHash('sha256').update(JSON.stringify({
  codes:freeze.codes,firstEligibleSignalDate:freeze.firstEligibleSignalDate,
  frozenAt:freeze.frozenAt,
 })).digest('hex');
}
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const instant=x=>typeof x==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(x)?Date.parse(x):NaN;
const actionFingerprint=r=>[
 r?.actionDetails?.adjustmentFactor??null,
 r?.actionDetails?.exRightsType??null,
 r?.actionDetails?.reason??null,
 r?.actionDetails?.independentlyVerified??null
];
const readBar=(b,code,date)=>b?.code===code&&b.tradeDate===date&&b.unadjusted===true&&
 [b.open,b.high,b.low,b.close,b.volume].every(number)&&
 b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close,b.high);
function inspect(freeze,snapshot){
 const errors=[];
 if(!snapshot||snapshot.version!==MA75_JQUANTS_PAGE_VERSION||
    snapshot.expectedFrozenCodes!==freeze.codes.length||
    !snapshot.paginationComplete||!Array.isArray(snapshot.failures)||snapshot.failures.length||
    !Array.isArray(snapshot.rows)||snapshot.rows.length!==freeze.codes.length)
  errors.push('BAD_ENVELOPE_OR_FROZEN_DENOMINATOR');
 if(!/^20\d\d-\d\d-\d\d$/.test(snapshot?.date??'')||
    Number.isNaN(Date.parse(snapshot?.date+'T00:00:00Z'))||
    new Date(Date.parse(snapshot?.date+'T00:00:00Z')).toISOString().slice(0,10)!==snapshot.date)
    errors.push('INVALID_TRADE_DATE');
 const codeToRow=new Map();
 if(Array.isArray(snapshot?.rows)){
  snapshot.rows.forEach((r,i)=>{
   const code=freeze.codes[i];
   if(r?.code!==code||r.tradeDate!==snapshot.date){
     errors.push('MISMATCHED_CODE_OR_TRADE_DATE');return;
   }
   if(!['DAILY_BAR','NO_TRADE','MISSING_PROVIDER_ROW','INVALID_OHLCV',
         'DUPLICATE_CODE_DATE','BLOCKED_PAGINATION','CORPORATE_ACTION_REVIEW'].includes(r.status)||
     (r.status==='DAILY_BAR'&&!readBar(r.bar,code,snapshot.date))||
     (r.status==='CORPORATE_ACTION_REVIEW'&&(
       !r.actionDetails||r.actionDetails.independentlyVerified!==false))||
     (r.status!=='DAILY_BAR'&&r.bar!==null))
     errors.push('INVALID_OR_INCONSISTENT_BAR');
   if(!['DAILY_BAR','NO_TRADE'].includes(r.status))
     errors.push('UNUSABLE_CODE_DAY');
   codeToRow.set(code,r);
  });
 }
 const first=instant(snapshot?.firstReceivedAt),last=instant(snapshot?.lastReceivedAt);
 const close=Date.parse(snapshot?.date+'T06:30:00Z');
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last||
    first<close||!Number.isInteger(snapshot?.readPages)||snapshot.readPages<1||
    !Number.isInteger(snapshot?.rawProviderRows)||snapshot.rawProviderRows<0)
   errors.push('INVALID_PAGE_PROVENANCE');
 const counts=snapshot?.counts;
 if(!counts||typeof counts!=='object'||Array.isArray(counts)||!Array.isArray(snapshot?.rows))
   errors.push('INVALID_REPORTED_COUNTS');
 else {
  for(const k of Object.keys(counts)){
    if(!Number.isInteger(counts[k])||counts[k]<0||
      counts[k]!==snapshot.rows.filter(x=>x?.status===k).length)
      errors.push('INVALID_REPORTED_COUNTS');
  }
  if(snapshot.rows.some(x=>!Object.prototype.hasOwnProperty.call(counts,x?.status))||
    snapshot.structurallyUsableRawBars!==
      snapshot.rows.filter(x=>x?.status==='DAILY_BAR').length)
    errors.push('INVALID_REPORTED_COUNTS');
 }
 if(snapshot?.eligibleForForwardSignal!==false||snapshot?.providerRightsVerified!==false)
    errors.push('UNSAFE_PROVIDER_VERIFICATION_CLAIM');
 const canonical={
  date:snapshot?.date,readPages:snapshot?.readPages,
  rawProviderRows:snapshot?.rawProviderRows,
  firstReceivedAt:snapshot?.firstReceivedAt,lastReceivedAt:snapshot?.lastReceivedAt,
  rows:freeze.codes.map(code=>{
   const row=codeToRow.get(code);
   const b=row?.bar;
   return {code,status:row?.status??null,
    bar:row?.status==='DAILY_BAR'?
     {open:b?.open,high:b?.high,low:b?.low,close:b?.close,volume:b?.volume}:null,
    action:r?.status==='CORPORATE_ACTION_REVIEW'?
      actionFingerprint(row):null};
  }),
 };
 const digest=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 return {errors:[...new Set(errors)],codeToRow,digest};
}
export function auditMa75JQuantsPageRevisions(freeze,{previous,current}={}){
 validateMa75FrozenUniverse(freeze);
 if(!previous||!current||typeof previous.date!=='string'||
    previous.date!==current.date)throw new TypeError('Both audits must have identical date');
 const a=inspect(freeze,previous),b=inspect(freeze,current);
 const changedCodes=[];
 for(const code of freeze.codes){
  const before=a.codeToRow.get(code),after=b.codeToRow.get(code);
  const p=before?.bar,q=after?.bar;
  if(before?.status!==after?.status||
     (before?.status==='CORPORATE_ACTION_REVIEW'&&
       JSON.stringify(actionFingerprint(before))!==JSON.stringify(actionFingerprint(after)))||
     (before?.status==='DAILY_BAR'&&
      [p?.open,p?.high,p?.low,p?.close,p?.volume].some((v,i)=>
       !Object.is(v,[q?.open,q?.high,q?.low,q?.close,q?.volume][i]))))
    changedCodes.push(code);
 }
 const receiptChanged=previous.firstReceivedAt!==current.firstReceivedAt||
    previous.lastReceivedAt!==current.lastReceivedAt||
    previous.readPages!==current.readPages;
 const changed=changedCodes.length>0||a.digest!==b.digest;
 const issues=[...a.errors.map(reason=>({side:'PREVIOUS',reason})),
               ...b.errors.map(reason=>({side:'CURRENT',reason}))];
 if(changedCodes.length)issues.push({side:'BOTH',reason:'FROZEN_CODE_DAY_VALUES_CHANGED'});
 if(receiptChanged)issues.push({side:'BOTH',reason:'RECEIPT_PROVENANCE_CHANGED'});
 if(changed&&!changedCodes.length&&!receiptChanged)
  issues.push({side:'BOTH',reason:'PROVIDER_ENVELOPE_REVISION'});
 return {
  version:MA75_PAGE_REVISION_VERSION,tradeDate:previous.date,
  frozenCodes:freeze.codes.length,
  frozenPopulationSha256:fingerprintMa75RevisionPopulation(freeze),
  previousSnapshotSha256:a.digest,
  currentSnapshotSha256:b.digest,
  changedCodes,changedCodeCount:changedCodes.length,
  receiptChanged,revisionDetected:changed,
  structurallyConsistent:issues.length===0,issues,
  approvedToOverwriteOriginal:false,
  replaysRequireIndependentReanalysis:issues.length>0,
  independentlyAuthenticatedProviderCapture:false,
  independentlyValidatedForwardWinRate:null,
  eligibleForProduction:false,eligibleForNotifications:false,
  warning:'A local SHA256 detects differences between these supplied archives; it is not a vendor signature, trusted timestamp or license verification.',
 };
}
