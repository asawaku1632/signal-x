import { runDailyLearning } from "@/app/lib/learning/learningScheduler";

export type AutoLearningMode = "preview" | "execute";

export type AutoLearningReport = {
  success: boolean;
  debugVersion: string;
  checkedAt: string;
  mode: AutoLearningMode;
  judgeLimit: number;
  minSampleCount: number;
  dailyLearning: Awaited<ReturnType<typeof runDailyLearning>>;
  summary: {
    processedCount: number;
    updatedCount: number;
    winCount: number;
    loseCount: number;
    holdCount: number;
    unknownCount: number;
    errorCount: number;
    weightRuleUpsertedCount: number;
  };
  nextAction: string;
};

const DEBUG_VERSION = "V22_AUTO_AI_LEARNING_SYSTEM_0706";

function normalizeMode(value: string | null | undefined): AutoLearningMode {
  return value === "execute" ? "execute" : "preview";
}

function safeLimit(value: number | undefined, fallback = 100) {
  if (!Number.isFinite(value)) return fallback;
  if ((value as number) < 1) return fallback;
  if ((value as number) > 500) return 500;
  return Math.floor(value as number);
}

function safeMinSampleCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 3;
  if ((value as number) < 1) return 3;
  if ((value as number) > 100) return 100;
  return Math.floor(value as number);
}

export async function runAutoLearning(options?: {
  mode?: string | null;
  judgeLimit?: number;
  minSampleCount?: number;
}): Promise<AutoLearningReport> {
  const mode = normalizeMode(options?.mode);
  const judgeLimit = safeLimit(options?.judgeLimit, 100);
  const minSampleCount = safeMinSampleCount(options?.minSampleCount);

  const dailyLearning = await runDailyLearning({
    mode,
    judgeLimit,
    minSampleCount,
  });

  const patternJudge = dailyLearning.patternJudge;
  const patternWeightTraining = dailyLearning.patternWeightTraining;

  const weightRuleUpsertedCount = patternWeightTraining?.upsertedCount ?? 0;

  return {
    success: true,
    debugVersion: DEBUG_VERSION,
    checkedAt: new Date().toISOString(),
    mode,
    judgeLimit,
    minSampleCount,
    dailyLearning,
    summary: {
      processedCount: patternJudge.processedCount,
      updatedCount: patternJudge.updatedCount,
      winCount: patternJudge.winCount,
      loseCount: patternJudge.loseCount,
      holdCount: patternJudge.holdCount,
      unknownCount: patternJudge.unknownCount,
      errorCount: patternJudge.errorCount,
      weightRuleUpsertedCount,
    },
    nextAction:
      mode === "preview"
        ? "preview内容を確認後、mode=executeで実行してください。"
        : "learning quality APIで品質スコア、判定済み件数、AI重みルール数を確認してください。",
  };
}
