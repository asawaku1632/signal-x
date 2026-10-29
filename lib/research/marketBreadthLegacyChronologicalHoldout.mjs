// Shadow-only chronological diagnostic on independently audited legacy outcome rows.
// Not a trading model or evidence of predictive improvement.
export function evaluateLegacyChronologicalHoldout({audit,holdoutDate,minimumTrainingDates=5,minimumHoldoutDates=3}={}){
 if(!audit||audit.researchOnly!==true||audit.aiPromotionAuthorized!==false||!Array.isArray(audit.accepted))throw new TypeError('REQUIRES_SHADOW_AUDIT');
 if(typeof holdoutDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(holdoutDate))throw new TypeError('INVALID_HOLDOUT_DATE');
 if(!Number.isInteger(minimumTrainingDates)||minimumTrainingDates<1||!Number.isInteger(minimumHoldoutDates)||minimumHoldoutDates<1)throw new TypeError('INVALID_DATE_REQUIREMENTS');
 const rows=audit.accepted;
 const hasDuplicate=rows.some((r,i)=>rows.findIndex(x=>x.date===r.date&&x.code===r.code)!==i);
 if(hasDuplicate)throw new TypeError('DUPLICATE_AUDITED_STOCK_DATE');
 if(rows.some(r=>!r||typeof r.date!=='string'||!Number.isFinite(r.changePercent)||!Number.isFinite(r.score)))throw new TypeError('INVALID_AUDITED_ROW');
 const training=rows.filter(r=>r.date<holdoutDate),holdout=rows.filter(r=>r.date>=holdoutDate);
 const overlappingOutcomes=training.filter(r=>typeof r.evaluatedTradeDate==='string'&&r.evaluatedTradeDate>=holdoutDate);
 const safeTraining=training.filter(r=>typeof r.evaluatedTradeDate==='string'&&r.evaluatedTradeDate<holdoutDate);
 const trainDates=new Set(safeTraining.map(r=>r.date)),testDates=new Set(holdout.map(r=>r.date));
 const average=a=>a.length?a.reduce((s,r)=>s+r.changePercent,0)/a.length:null;
 const equalDateAverage=a=>{const days=[...new Set(a.map(r=>r.date))];return days.length?days.reduce((s,d)=>s+average(a.filter(r=>r.date===d)),0)/days.length:null};
 const summary=a=>({observations:a.length,distinctDates:new Set(a.map(r=>r.date)).size,meanReturnPercent:average(a),equalDateMeanReturnPercent:equalDateAverage(a),positiveRate:a.length?a.filter(r=>r.changePercent>0).length/a.length:null});
 const reasons=[];
 if(trainDates.size<minimumTrainingDates)reasons.push('INSUFFICIENT_TRAINING_DATES');
 if(testDates.size<minimumHoldoutDates)reasons.push('INSUFFICIENT_HOLDOUT_DATES');
 if(audit.counts?.quarantined||audit.counts?.rejected)reasons.push('EXCLUDED_UNVERIFIED_ROWS');
 if(overlappingOutcomes.length)reasons.push('TRAINING_OUTCOME_OVERLAPS_HOLDOUT');
 reasons.push('NO_FROZEN_BASELINE','NO_INDEPENDENT_PRICE_ATTESTATION','NO_TRANSACTION_COSTS');
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,independentImprovementVerified:false,holdoutDate,training:summary(safeTraining),excludedOverlappingTrainingOutcomes:overlappingOutcomes.length,holdout:summary(holdout),diagnosticEligible:trainDates.size>=minimumTrainingDates&&testDates.size>=minimumHoldoutDates,reasons};
}
