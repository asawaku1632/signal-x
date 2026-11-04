/**
 * SHADOW-ONLY. Validates an already committed pre-forward candidate list and
 * converts it into the strict, hash-identified research manifest.
 * No data fetch, paid API access, automatic collection or live signal.
 */
import { createMa75ForwardManifest } from './ma75ForwardProtocol.mjs';
export const MA75_FROZEN_UNIVERSE_VERSION='ma75-forward-universe-candidate-freeze-v1';
const DAY=/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const validDay=d=>typeof d==='string'&&DAY.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const stamp=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
export function validateMa75FrozenUniverse(freeze){
  if(!freeze||typeof freeze!=='object'||freeze.schemaVersion!==MA75_FROZEN_UNIVERSE_VERSION)
    throw new TypeError('Unknown frozen universe schema');
  const codes=freeze.codes;
  if(!Array.isArray(codes)||codes.length===0||
     codes.some(c=>typeof c!=='string'||!/^[0-9]{3}[0-9A-Z]$/.test(c))||
     codes.some((c,i)=>i>0&&c<=codes[i-1])||
     freeze.populationSize!==codes.length)
    throw new TypeError('Frozen code count, sort order and unique code format required');
  const frozenAt=stamp(freeze.frozenAt);
  if(!Number.isFinite(frozenAt)||!validDay(freeze.firstEligibleSignalDate)||
     freeze.firstEligibleSignalDate<=new Date(frozenAt+9*3600000).toISOString().slice(0,10))
    throw new TypeError('The freeze must precede its first forward signal date');
  if(!freeze.selectionSQL?.includes("date = '2026-10-30'")||
     typeof freeze.historicalSelectionBias!=='string'||
     freeze.historicalSelectionBias.length<30)
    throw new TypeError('Historical source selection and bias must be explicit');
  for(const name of ['providerRights','barCaptureTimestamps','splitAdjustments','officialTradingCalendar','liquidityCoverage']){
    if(freeze.sourceChecks?.[name]!=='UNVERIFIED')
      throw new TypeError('A public snapshot cannot self-certify external market-data rights');
  }
  if(freeze.automaticCollectionEnabled!==false||freeze.liveTradingEligible!==false||
     freeze.notificationEligible!==false||freeze.independentlyValidatedForwardReturns!==0)
    throw new TypeError('Frozen candidate list must stay research-only');
  return {version:MA75_FROZEN_UNIVERSE_VERSION,codes:codes.length,
    frozenAt:freeze.frozenAt,firstSignalDate:freeze.firstEligibleSignalDate,
    structuralValidationPassed:true,independentlyVerifiedSourceRights:false,
    broadMarketCoverageVerified:false,eligibleForProduction:false};
}
export function manifestFromMa75FrozenUniverse(freeze){
  validateMa75FrozenUniverse(freeze);
  return createMa75ForwardManifest({
    frozenAt:freeze.frozenAt,firstSignalDate:freeze.firstEligibleSignalDate,
    cohortCodes:freeze.codes,selectionPolicy:freeze.selectionSQL,
    source:{provider:'J-Quants',usageRights:'UNVERIFIED',
      corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'},
  });
}
