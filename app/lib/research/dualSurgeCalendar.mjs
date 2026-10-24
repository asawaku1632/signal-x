// Research-only strict ISO calendar date guard; rejects Date.parse normalization.
export function validIsoSessionDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split("-").map(Number);
 if(year<1900||year>2100||month<1||month>12||day<1||day>31)return false;
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
}
