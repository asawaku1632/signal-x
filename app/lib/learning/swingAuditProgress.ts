// Portable progress token for a bounded audit. This is not a proof of
// a consistent DB snapshot across separate invocations.
export type AuditCursor={tradeDate:string;code:string};
export type AuditProgress={version:1;ruleVersion:string;cursor:AuditCursor|null;inspected:number;eligibleAtStart:number;issueCount:number;completed:boolean};
export function validateAuditProgress(p:AuditProgress){
 if(p.version!==1||!/^[a-z0-9_.-]{1,80}$/i.test(p.ruleVersion))throw Error("INVALID_AUDIT_PROGRESS");
 for(const n of [p.inspected,p.eligibleAtStart,p.issueCount])if(!Number.isSafeInteger(n)||n<0)throw Error("INVALID_AUDIT_PROGRESS");
 if(p.inspected>p.eligibleAtStart||p.issueCount>p.inspected)throw Error("INVALID_AUDIT_PROGRESS");
 if(p.cursor&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.cursor.tradeDate)||!/^[a-zA-Z0-9]{4,10}$/.test(p.cursor.code)))throw Error("INVALID_AUDIT_CURSOR");
 if(p.inspected>0&&!p.cursor||p.completed&&p.inspected!==p.eligibleAtStart)throw Error("INVALID_AUDIT_PROGRESS");
 return p;
}
export function advanceAuditProgress(current:AuditProgress,step:{rows:number;issues:number;last:AuditCursor|null;remaining:number}){
 validateAuditProgress(current);
 if(current.completed||!Number.isSafeInteger(step.rows)||step.rows<0||!Number.isSafeInteger(step.issues)||step.issues<0||step.issues>step.rows||!Number.isSafeInteger(step.remaining)||step.remaining<0)throw Error("INVALID_AUDIT_STEP");
 if(step.rows>0&&!step.last||step.rows===0&&step.last)throw Error("INVALID_AUDIT_STEP");
 const next={...current,cursor:step.last??current.cursor,inspected:current.inspected+step.rows,issueCount:current.issueCount+step.issues,completed:step.remaining===0};
 if(next.inspected+step.remaining!==current.eligibleAtStart)throw Error("AUDIT_COUNT_DRIFT");
 return validateAuditProgress(next);
}
