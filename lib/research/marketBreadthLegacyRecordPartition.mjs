// Partition existing legacy records for descriptive analysis; never infer independent forward proof.
const validCode=code=>typeof code==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(code);
const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
export function partitionMarketBreadthLegacyRecords({bbEvents=[],technicalEvents=[]}={}){
 if(!Array.isArray(bbEvents)||!Array.isArray(technicalEvents))throw new TypeError('INVALID_LEGACY_RECORDS');
 const partitions={descriptive:[],quarantined:[]};
 for(const [kind,records] of [['bb',bbEvents],['technical',technicalEvents]]){
  for(const record of records){
   const id=record?.id??null,code=record?.code??null;
   const tradeDate=kind==='bb'?record?.signal_date:record?.signal_trade_date;
   const createdAt=record?.created_at;
   let reason=null;
   if(!validCode(code))reason='DEV_OR_INVALID_SECURITY_CODE';
   else if(!validDate(tradeDate)||typeof createdAt!=='string'||!Number.isFinite(Date.parse(createdAt)))reason='INVALID_LEGACY_DATE';
   else if(Date.parse(createdAt)<Date.parse(tradeDate+'T00:00:00+09:00'))reason='INCONSISTENT_CREATED_AT';
   const item={kind,id,code,tradeDate,classification:reason?'QUARANTINED':'DESCRIPTIVE_UNVERIFIED',reason:reason??'INDEPENDENT_FORWARD_PROVENANCE_NOT_ESTABLISHED'};
   (reason?partitions.quarantined:partitions.descriptive).push(item);
  }
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,counts:{submitted:bbEvents.length+technicalEvents.length,descriptive:partitions.descriptive.length,quarantined:partitions.quarantined.length,verifiedForward:0},...partitions};
}
