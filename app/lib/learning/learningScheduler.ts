import { runPatternJudge } from "@/app/lib/learning/patternJudgeEngine";
import { trainPatternWeightRules } from "@/app/lib/learning/weightRuleTrainer";

export type DailyLearningMode = "preview" | "execute";

export type DailyLearningReport = {
  checkedAt: string;
  mode: DailyLearningMode;
  judgeLimit: number;
  minSampleCount: number;
  patternJudge: Awaited<ReturnType<typeof runPatternJudge>>;
  patternWeightTraining:
    | Awaited<ReturnType<typeof trainPatternWeightRules>>
    | null;
  nextAction: string;
};

function normalizeMode(value: string | null | undefined): DailyLearningMode {
  return value === "execute" ? "execute" : "preview";
}

function safeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  if ((value as number) < 1) return 20;
  if ((value as number) > 300) return 300;
  return Math.floor(value as number);
}

function safeMinSampleCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 3;
  if ((value as number) < 1) return 3;
  if ((value as number) > 100) return 100;
  return Math.floor(value as number);
}

export async function runDailyLearning(options?: {
  mode?: string | null;
  judgeLimit?: number;
  minSampleCount?: number;
}): Promise<DailyLearningReport> {
  const mode = normalizeMode(options?.mode);
  const judgeLimit = safeLimit(options?.judgeLimit);
  const minSampleCount = safeMinSampleCount(options?.minSampleCount);

  const patternJudge = await runPatternJudge({
    mode,
    limit: judgeLimit,
  });

  const patternWeightTraining =
    mode === "execute"
      ? await trainPatternWeightRules({
          minSampleCount,
        })
      : null;

  return {
    checkedAt: new Date().toISOString(),
    mode,
    judgeLimit,
    minSampleCount,
    patternJudge,
    patternWeightTraining,
    nextAction:
      mode === "preview"
        ? "内容を確認して問題なければ mode=execute で少量から実行してください。"
        : "learning quality APIで judgedRecords と pattern_learning_logs の改善を確認してください。",
  };
}
