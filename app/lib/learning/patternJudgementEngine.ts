import pool from "@/app/lib/postgres";

export type PatternJudgement = "WIN" | "LOSE" | "HOLD" | "UNKNOWN";

export type PatternJudgementCandidate = {
  id?: number;
  code?: string;
  patternKey?: string;
  date?: string;
  entryPrice?: number;
  currentPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  currentResult?: string;
  suggestedResult: PatternJudgement;
  reason: string;
};

export type PatternJudgementPreviewReport = {
  checkedAt: string;
  targetCount: number;
  previewLimit: number;
  suggestedWin: number;
  suggestedLose: number;
  suggestedHold: number;
  suggestedUnknown: number;
  columns: string[];
  candidates: PatternJudgementCandidate[];
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function pickFirst(row: any, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }

  return undefined;
}

function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function judgeByPrice(row: any): {
  result: PatternJudgement;
  reason: string;
} {
  const entryPrice = toNumber(
    pickFirst(row, ["entry_price", "price", "base_price", "signal_price"])
  );

  const currentPrice = toNumber(
    pickFirst(row, [
      "current_price",
      "close_price",
      "result_price",
      "judged_price",
      "exit_price",
      "latest_price",
    ])
  );

  const takeProfit = toNumber(
    pickFirst(row, ["take_profit", "take_profit_price", "target_price"])
  );

  const stopLoss = toNumber(
    pickFirst(row, ["stop_loss", "stop_loss_price", "loss_cut_price"])
  );

  if (entryPrice <= 0) {
    return {
      result: "UNKNOWN",
      reason: "基準価格カラムが見つからない、または値が不正です。",
    };
  }

  if (currentPrice <= 0) {
    return {
      result: "UNKNOWN",
      reason: "判定価格カラムが見つからない、または値が不正です。",
    };
  }

  if (takeProfit > 0 && currentPrice >= takeProfit) {
    return {
      result: "WIN",
      reason: "判定価格が利確価格以上です。",
    };
  }

  if (stopLoss > 0 && currentPrice <= stopLoss) {
    return {
      result: "LOSE",
      reason: "判定価格が損切価格以下です。",
    };
  }

  const changeRate = ((currentPrice - entryPrice) / entryPrice) * 100;

  if (changeRate >= 3) {
    return {
      result: "WIN",
      reason: "基準価格から3%以上上昇しています。",
    };
  }

  if (changeRate <= -2) {
    return {
      result: "LOSE",
      reason: "基準価格から2%以上下落しています。",
    };
  }

  return {
    result: "HOLD",
    reason: "利確・損切に未到達で値動きも判定閾値内です。",
  };
}

async function getPatternLearningColumns(): Promise<string[]> {
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'pattern_learning_logs'
    ORDER BY ordinal_position
    `
  );

  return rows.map((row) => String(row.column_name));
}

export async function buildPatternJudgementPreview(
  previewLimit = 50
): Promise<PatternJudgementPreviewReport> {
  const safeLimit = Math.max(1, Math.min(500, previewLimit));
  const columns = await getPatternLearningColumns();

  const countResult = await pool.query(`
    SELECT COUNT(*) AS target_count
    FROM pattern_learning_logs
    WHERE result IS NULL OR result NOT IN ('WIN', 'LOSE')
  `);

  const targetCount = toNumber(countResult.rows[0]?.target_count);

  const { rows } = await pool.query(
    `
    SELECT *
    FROM pattern_learning_logs
    WHERE result IS NULL OR result NOT IN ('WIN', 'LOSE')
    LIMIT $1
    `,
    [safeLimit]
  );

  const candidates: PatternJudgementCandidate[] = rows.map((row: any) => {
    const judgement = judgeByPrice(row);

    return {
      id: pickFirst(row, ["id"]) ? toNumber(pickFirst(row, ["id"])) : undefined,
      code: pickFirst(row, ["code", "stock_code"])
        ? String(pickFirst(row, ["code", "stock_code"]))
        : undefined,
      patternKey: pickFirst(row, ["pattern_key", "patternKey"])
        ? String(pickFirst(row, ["pattern_key", "patternKey"]))
        : undefined,
      date: toDateString(
        pickFirst(row, ["trade_date", "date", "created_at", "judged_at", "updated_at"])
      ),
      entryPrice:
        toNumber(pickFirst(row, ["entry_price", "price", "base_price", "signal_price"])) ||
        undefined,
      currentPrice:
        toNumber(
          pickFirst(row, [
            "current_price",
            "close_price",
            "result_price",
            "judged_price",
            "exit_price",
            "latest_price",
          ])
        ) || undefined,
      takeProfit:
        toNumber(pickFirst(row, ["take_profit", "take_profit_price", "target_price"])) ||
        undefined,
      stopLoss:
        toNumber(pickFirst(row, ["stop_loss", "stop_loss_price", "loss_cut_price"])) ||
        undefined,
      currentResult: pickFirst(row, ["result"])
        ? String(pickFirst(row, ["result"]))
        : undefined,
      suggestedResult: judgement.result,
      reason: judgement.reason,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    targetCount,
    previewLimit: safeLimit,
    suggestedWin: candidates.filter((c) => c.suggestedResult === "WIN").length,
    suggestedLose: candidates.filter((c) => c.suggestedResult === "LOSE").length,
    suggestedHold: candidates.filter((c) => c.suggestedResult === "HOLD").length,
    suggestedUnknown: candidates.filter((c) => c.suggestedResult === "UNKNOWN").length,
    columns,
    candidates,
  };
}
