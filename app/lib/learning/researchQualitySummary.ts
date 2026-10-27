// Read-only presentation derived from already aggregated research report.
// Does not query/write the DB or grant automated research approval.
export type ResearchQualityGroup = {
  count: number;
  outcomes: Array<{days:number;checked:number}>;
};
export type ResearchQualityReport = {
  total: number; latestDate: string|null; groups:ResearchQualityGroup[];
};
export function summarizeResearchQuality(report:ResearchQualityReport, now:Date){
  const total = Number.isSafeInteger(report.total) && report.total >= 0 ? report.total : 0;
  const latestDate=/^20\d{2}-\d{2}-\d{2}$/.test(report.latestDate??"")?report.latestDate:null;
  const todayJst=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const age=latestDate?Math.floor((Date.parse(todayJst+"T00:00:00Z")-Date.parse(latestDate+"T00:00:00Z"))/86400000):null;
  const freshnessLabel=age===null||!Number.isFinite(age)?"鮮度不明":age<0?"日付要確認":age<=3?"直近3暦日以内":age<=10?"4〜10暦日前":"10暦日超（要確認）";
  const horizons=[1,3,5,10].map(days=>{
    let checked=0, denominator=0;
    for(const group of report.groups??[]){
      if(!Number.isSafeInteger(group.count)||group.count<0)continue;
      denominator+=group.count;
      const match=(group.outcomes??[]).find(x=>x.days===days);
      if(match&&Number.isSafeInteger(match.checked)&&match.checked>=0&&match.checked<=group.count)checked+=match.checked;
    }
    return {days,total:denominator,checked,pending:Math.max(0,denominator-checked),
      completionPct:denominator>0?checked/denominator*100:null};
  });
  return {total,latestDate,freshnessLabel,horizons};
}
