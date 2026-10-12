import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MSB_PRESETS,msbPresetCodes,classifyMsbResearchCode } from "../app/lib/research/msbResearchPresets.ts";
import {summarizeArchivedMsb} from "../app/lib/research/msbMaArchiveStats.ts";
import {SWING_SHADOW_VERSION} from "../app/lib/research/msbMaSwing.ts";
import {VOLUME_SENSITIVITY_VERSION} from "../app/lib/research/msbMaVolumeSensitivity.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const t=(code,signal,profit,breakout,retest,overrides={})=>({
  detector_version:SWING_SHADOW_VERSION, volume_version:VOLUME_SENSITIVITY_VERSION,
  code, signal_time:signal, entry_time:signal+86400, exit_time:signal+5*86400,
  profit_yen_100:profit, return_percent:profit/1000,
  volume_eligible:false,ob_eligible:true,breakout_ratio:breakout,retest_ratio:retest,...overrides,
});
const e=1780000000;
const group=(summary,key)=>summary.groups.find(x=>x.group===key);
const row=(g,th)=>g.thresholds.find(r=>r.threshold===th);

test("A/B retained and exactly 30 predeclared distinct new codes are separated",()=>{
  assert.deepEqual([...MSB_PRESETS.A],["3182","3387","6855","7203","9984"]);
  assert.deepEqual([...MSB_PRESETS.B],["1605","2760","3994","5805","8058"]);
  const all=Object.values(MSB_PRESETS).flat();
  assert.equal(all.length,40);assert.equal(new Set(all).size,40);
  assert.ok(all.every(c=>/^[0-9]{4}$/.test(c)));
  assert.equal(msbPresetCodes("C")?.length,5);
  assert.equal(msbPresetCodes("__proto__"),null);
  assert.equal(classifyMsbResearchCode("6855"),"DISCOVERY");
  assert.equal(classifyMsbResearchCode("8306"),"ADDITIONAL");
  assert.equal(classifyMsbResearchCode("1234"),"CUSTOM");
});

test("archive is deduplicated by signal identity, and no future overlapping entries for a stock",()=>{
  const summary=summarizeArchivedMsb([
    t("3182",e,200,1.4,.8),t("3182",e,200,1.4,.8),
    t("3182",e+86400,500,2,1.6),
    t("3182",e+6*86400,-90,1.1,.9),
    t("8306",e+86400,300,2.1,1.6),
  ]);
  assert.equal(summary.uniqueObservations,4);
  assert.equal(summary.duplicateRowsDiscarded,1);
  assert.equal(group(summary,"ALL").obNonOverlapCount,3);
  assert.equal(group(summary,"DISCOVERY").obNonOverlapCount,2);
  assert.equal(group(summary,"ADDITIONAL").obNonOverlapCount,1);
  assert.equal(group(summary,"CUSTOM").obNonOverlapCount,0);
});
test("one fixed OB set is filtered by all breakout and retest thresholds, with unknown failing positive thresholds",()=>{
  const summary=summarizeArchivedMsb([
    t("3182",e,100,1.5,.8),t("8306",e,300,1.6,1.2),
    t("8306",e+6*86400,-100,null,null),
  ]);
  const g=group(summary,"ALL");
  assert.equal(row(g,0).both.count,3);
  assert.equal(row(g,1.5).breakout.count,2);
  assert.equal(row(g,1.5).retest.count,0);
  assert.equal(row(g,1.2).both.count,1);
  assert.equal(row(g,1.2).both.winRate,100);
  assert.equal(row(g,1.5).both.winRate,null);
  assert.equal(row(g,1.5).both.sumYen100,null);
});
test("same initial results stay separate from new-code validation even after future outcomes change",()=>{
  const early=summarizeArchivedMsb([t("3182",e,-200,1.1,.8)]);
  const later=summarizeArchivedMsb([t("3182",e,-200,1.1,.8),t("8306",e,800,2.1,2)]);
  assert.deepEqual(group(early,"DISCOVERY"),group(later,"DISCOVERY"));
  assert.equal(group(later,"ADDITIONAL").obNonOverlapCount,1);
  assert.equal(group(later,"ADDITIONAL").base.winRate,100);
  assert.equal(group(later,"ALL").base.winRate,50);
});
test("invalid rows cannot inflate a claimed win rate",()=>{
  const valid=t("3182",e,100,1.2,.9);
  const summary=summarizeArchivedMsb([
    valid,
    {...valid,code:"3182;DROP"},
    {...valid,volume_version:"unreviewed"},
    {...valid,signal_time:0},
    {...valid,breakout_ratio:-1},
    {...valid,ob_eligible:false},
  ]);
  assert.equal(summary.invalidRowsDiscarded,5);
  assert.equal(summary.uniqueObservations,1);
  assert.equal(group(summary,"ALL").ob.winRate,100);
});
test("owner checked before any Yahoo or DB calls; bounded explicit archive write only",()=>{
  const page=read("app/admin/shadow-msb-ob-swing/page.tsx");
  const save=read("app/admin/shadow-msb-ob-swing/actions.ts");
  const archive=read("app/admin/shadow-msb-ob-swing/archive/page.tsx");
  const migration=read("supabase/migrations/20261012_create_msb_volume_research_archive.sql");
  assert.ok(save.indexOf("if (!isOwner) notFound()")>=0);
  assert.ok(save.indexOf("if (!isOwner) notFound()") < save.indexOf("await fetchCohort(codes)"));
  assert.ok(save.indexOf("await fetchCohort(codes)") < save.indexOf("await pool.connect()"));
  assert.match(save, /codes.length > 5/);
  assert.match(save, /ON CONFLICT\(detector_version,volume_version,code,signal_time\) DO NOTHING/);
  assert.ok(archive.indexOf("if(!isOwner)notFound()")<archive.indexOf("pool.query"));
  assert.doesNotMatch(archive, /fetchCohort\(/);
  assert.match(page, /form="msb-research-form"/);
  assert.match(page, /action=\{saveMsbVolumeResearch\}/);
  assert.match(page, /MSB_PRESET_GROUPS.slice\(2\)/);
  assert.match(migration,/ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE|ALTER TABLE public\.(?:daily_stock|paper|learning)|CREATE TRIGGER|CREATE POLICY)\b/i);
  assert.doesNotMatch(save,/\b(?:runScan|sendLine|calculateAiScore|savePaperTrade)\s*\(/);
});
