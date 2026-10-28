// Fail-closed, pure restart gate. Does not persist or approve research.
export type ResumeGuardInput={
 auditId:string;ruleVersion:string;storedRuleVersion:string;
 storedFingerprint:string;currentFingerprint:string;
 eligibleAtStart:number;eligibleNow:number;inspected:number;
 cursorDate:string|null;cursorCode:string|null;completed:boolean;
};
export function decideAuditResume(e:ResumeGuardInput){
 const reasons:string[]=[];
 if(!/^[a-z0-9_-]{1,80}$/i.test(e.auditId))reasons.push("INVALID_AUDIT_ID");
 if(!e.ruleVersion||e.ruleVersion!==e.storedRuleVersion)reasons.push("RULE_VERSION_MISMATCH");
 if(!/^[a-f0-9]{32}$/.test(e.storedFingerprint)||!/^[a-f0-9]{32}$/.test(e.currentFingerprint))reasons.push("INVALID_FINGERPRINT");
 else if(e.storedFingerprint!==e.currentFingerprint)reasons.push("DATASET_CHANGED");
 if(!Number.isSafeInteger(e.eligibleAtStart)||!Number.isSafeInteger(e.eligibleNow)||!Number.isSafeInteger(e.inspected)||e.eligibleAtStart<0||e.eligibleNow<0||e.inspected<0||e.inspected>e.eligibleAtStart)reasons.push("INVALID_COUNTS");
 else if(e.eligibleAtStart!==e.eligibleNow)reasons.push("ELIGIBLE_COUNT_CHANGED");
 if(e.inspected>0&&(!e.cursorDate||!e.cursorCode))reasons.push("MISSING_CURSOR");
 if(e.cursorDate&&!/^\d{4}-\d{2}-\d{2}$/.test(e.cursorDate))reasons.push("INVALID_CURSOR_DATE");
 if(e.cursorCode&&!/^[a-zA-Z0-9]{4,10}$/.test(e.cursorCode))reasons.push("INVALID_CURSOR_CODE");
 if(e.completed)reasons.push("ALREADY_COMPLETED");
 return {action:reasons.length?"STOP":"RESUME",reasons,productionApplied:false as const,notificationEnabled:false as const,adoptionApproved:false as const};
}
