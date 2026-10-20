/** Research All-Stars: prospective evidence registry, NOT a trading recommendation.
 * All criteria and cohorts below are fixed before the confirmation window.
 * Never re-label historic decisions; never promote from a cherry-picked subset.
 */
export const ALLSTAR_POLICY="ALLSTAR_FIVE_DAY_COHORT_V1";
export const DISCOVERY_END="2026-11-20";
export const CONFIRMATION_FROM="2026-12-01";
export const STUDIES=Object.freeze([
  {key:"MM_V1",title:"🚀 爆益前兆 / Momentum Memory",href:"/admin/momentum-memory",family:"signal",
    method:"保存済みのFORWARD検出から5記録日後の参考騰落率"},
  {key:"HAP_V1",title:"💎 高AI・押し目",href:"/admin/high-ai-pullback",family:"signal",
    method:"高AIと押し目条件のFORWARD検出後の5記録日結果"},
  {key:"AIR_V1",title:"⛏️ AI反転・深押し",href:"/admin/ai-reversal",family:"signal",
    method:"AI反転観測のFORWARD検出後の5記録日結果"},
  {key:"TPR_V1",title:"🌱 トレンド押し目反転",href:"/admin/trend-pullback-reversal",family:"signal",
    method:"トレンド押し目条件のFORWARD検出後の5記録日結果"},
  {key:"AVOID_0_19",title:"🔴 AI POWER 0〜19 見送り後",href:"/simulation/universe-check",family:"score",
    method:"全銘柄のAI POWERだけに基づく見送り判定から5取引日後"},
  {key:"AVOID_20_39",title:"🔴 AI POWER 20〜39 見送り後",href:"/simulation/universe-check",family:"score",
    method:"全銘柄のAI POWERだけに基づく見送り判定から5取引日後"},
  {key:"AVOID_40_54",title:"🔴 AI POWER 40〜54 見送り後",href:"/simulation/universe-check",family:"score",
    method:"全銘柄のAI POWERだけに基づく見送り判定から5取引日後"},
  {key:"AVOID_55_64",title:"🔴 AI POWER 55〜64 見送り後",href:"/simulation/universe-check",family:"score",
    method:"全銘柄のAI POWERだけに基づく見送り判定から5取引日後"}
]);
/** The other studies are catalogued, not retrospectively awarded using
 * incomparable targets or unverified in-sample results.
 */
export const WAITING_STUDIES=Object.freeze([
 {label:"翌9:10仮想購入・弱AI逆張り",href:"/admin/weak-ai-rebound",reason:"翌朝参考価格の新規前向き観測。5日後の独立確認が必要"},
 {label:"朝9:10・4つの利確時刻",href:"/admin/exit-timing-study",reason:"同一日の5分足・最大逆行と持越しとは評価軸が違う"},
 {label:"前夜候補・朝最終チェック",href:"/admin/morning-final-check",reason:"朝の保存時刻と当日エントリー可能性を確認してから評価"},
 {label:"時間帯別エントリー最適化",href:"/admin/entry-time-shadow",reason:"日中の仮想約定値と5日後騰落率は混合しない"},
 {label:"BB上抜け・前向き検証",href:"/admin/bollinger-breakout-shadow",reason:"検知前の固定・保存品質・十分な日数を検証してから接続"},
 {label:"支持線反発の実証",href:"/admin/support-rebound",reason:"過去足再現と当日固定前向き結果を分けて監査"},
 {label:"15:15事前固定候補",href:"/admin/preclose-candidates",reason:"寄付き約定とのズレと翌日照合が完了してから接続"},
 {label:"暴落後の強弱研究",href:"/admin/crash-strength",reason:"実際に暴落が起きた日の前向き観測と市場超過結果を待つ"},
 {label:"ローソク足・水平線・チャートパターン",href:"/admin/shadow-candlestick-nine/archive",reason:"異なる定義の勝率を混同せずに統一の未来検証が必要"}
]);

const whole=n=>typeof n==="number"&&Number.isFinite(n)&&Number.isInteger(n)&&n>=0;
const valid=n=>typeof n==="number"&&Number.isFinite(n);
const round=n=>n==null?null:Number(n.toFixed(3));
const mean=ns=>ns.length?ns.reduce((x,y)=>x+y,0)/ns.length:null;
const pct=(count,total)=>total?100*count/total:null;
export function normaliseDaily(raw) {
 if(!raw||!/^(20\d\d)-(\d\d)-(\d\d)$/.test(String(raw.trade_date)))return null;
 const total=Number(raw.total),done=Number(raw.completed),
  up=Number(raw.up_count),loss=Number(raw.deep_loss_count);
 const bTotal=Number(raw.benchmark_total??0),bDone=Number(raw.benchmark_completed??0);
 const ret=raw.avg_return==null?null:Number(raw.avg_return);
 const bench=raw.benchmark_average==null?null:Number(raw.benchmark_average);
 const worst=raw.worst_return==null?null:Number(raw.worst_return);
 if(!whole(total)||!whole(done)||!whole(up)||!whole(loss)||
  done>total||up>done||loss>done||!STUDIES.some(s=>s.key===raw.study_key)||
  !Array.isArray(raw.codes)||raw.codes.some(s=>!/^[0-9]{4}$/.test(String(s))))return null;
 return {
  key:String(raw.study_key),date:String(raw.trade_date),total,done,up,deepLoss:loss,
  codes:[...new Set(raw.codes.map(String))],
  mean:valid(ret)?ret:null,worst:valid(worst)?worst:null,
  benchmarkTotal:whole(bTotal)?bTotal:0,
  benchmarkDone:whole(bDone)?bDone:0,benchmark:valid(bench)?bench:null
 };
}
function phase(rows) {
 const unique=[...new Map(rows.map(r=>[r.date,r])).values()];
 const complete=unique.filter(r=>r.total>=1&&r.done>=Math.ceil(r.total*.8)&&
   r.done>0&&r.mean!==null&&r.worst!==null);
 const paired=complete.filter(r=>r.benchmarkTotal>=800&&
   r.benchmarkDone>=Math.ceil(r.benchmarkTotal*.8)&&r.benchmark!==null);
 const n=paired.reduce((s,r)=>s+r.done,0);
 const up=paired.reduce((s,r)=>s+r.up,0);
 const deepLoss=paired.reduce((s,r)=>s+r.deepLoss,0);
 const prices=paired.map(r=>r.mean);
 const excess=paired.map(r=>r.mean-r.benchmark);
 const codes=new Set(paired.flatMap(r=>r.codes));
 const months=new Set(paired.map(r=>r.date.slice(0,7)));
 return {
  totalRecorded:unique.reduce((s,r)=>s+r.total,0),
  validBeforeBenchmark:complete.length,
  excludedDueToBenchmark:complete.length-paired.length,
  days:paired.length,cases:n,codes:codes.size,months:months.size,
  positiveRate:round(pct(up,n)),average5:round(n?paired.reduce((s,r)=>s+r.mean*r.done,0)/n:null),
  severeLossRate:round(pct(deepLoss,n)),
  worst5:paired.length?round(Math.min(...paired.map(r=>r.worst))):null,
  relativeToUniverse:round(mean(excess)),
  daysBeating:paired.filter(r=>r.mean>r.benchmark).length,
  dayWinRate:round(pct(paired.filter(r=>r.mean>r.benchmark).length,paired.length))
 };
}
export function qualifyCandidate(summary) {
 const reasons=[];
 if(summary.cases<50)reasons.push("照合50件以上");
 if(summary.days<10)reasons.push("独立した判定日10日以上");
 if(summary.codes<20)reasons.push("異なる銘柄20以上");
 if(summary.months<2)reasons.push("異なる月2か月以上");
 if(summary.positiveRate===null||summary.positiveRate<60)reasons.push("5日後プラス率60%以上");
 if(summary.average5===null||summary.average5<.8)reasons.push("5日後平均+0.8%以上");
 if(summary.severeLossRate===null||summary.severeLossRate>20)reasons.push("−5%以下の割合20%以下");
 if(summary.relativeToUniverse===null||summary.relativeToUniverse<.3)reasons.push("同日全銘柄平均超過+0.3ポイント以上");
 if(summary.dayWinRate===null||summary.dayWinRate<60)reasons.push("全銘柄平均を上回った判定日60%以上");
 return reasons;
}
export function qualifyConfirmation(summary) {
 const reasons=[];
 if(summary.cases<30)reasons.push("12月以降の照合30件以上");
 if(summary.days<10)reasons.push("12月以降の独立した判定日10日以上");
 if(summary.codes<15)reasons.push("12月以降の異なる銘柄15以上");
 if(summary.positiveRate===null||summary.positiveRate<55)reasons.push("別期間のプラス率55%以上");
 if(summary.average5===null||summary.average5<.2)reasons.push("別期間の平均+0.2%以上");
 if(summary.severeLossRate===null||summary.severeLossRate>25)reasons.push("別期間で−5%以下の割合25%以下");
 if(summary.relativeToUniverse===null||summary.relativeToUniverse<.15)reasons.push("別期間の同日全銘柄平均超過+0.15ポイント以上");
 if(summary.dayWinRate===null||summary.dayWinRate<55)reasons.push("別期間の全銘柄平均超過日55%以上");
 return reasons;
}
export function evaluateResearchAllStars(raw) {
 const parsed=(Array.isArray(raw)?raw:[]).map(normaliseDaily).filter(Boolean);
 return STUDIES.map(study=>{
   const rows=parsed.filter(r=>r.key===study.key);
   const discovery=phase(rows.filter(r=>r.date<=DISCOVERY_END));
   const confirmation=phase(rows.filter(r=>r.date>=CONFIRMATION_FROM));
   const needDiscovery=qualifyCandidate(discovery);
   const needConfirmation=qualifyConfirmation(confirmation);
   const status=needDiscovery.length===0 && needConfirmation.length===0?"ALL_STAR":
     needDiscovery.length===0?"CONFIRMING":"COLLECTING";
   const latest=rows.map(r=>r.date).sort().at(-1)??null;
   return {...study,status,latest,discovery,confirmation,
     unmet:status==="ALL_STAR"?[]:status==="CONFIRMING"?needConfirmation:needDiscovery,
     rule:"5d",reference:"同じ判定日の全銘柄単純平均（対象自身を含む）"};
 });
}
