type AiCommentInput = {
  qualityScore: number;
  overallWinRate: number;
  processedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  changedWeight: number;
  patternCount: number;
  previous?: {
    qualityScore: number;
    overallWinRate: number;
    processedCount: number;
    patternCount: number;
    changedWeight: number;
  } | null;
};

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

function diffText(label: string, current: number, previous: number, suffix = "") {
  const diff = Number((current - previous).toFixed(1));

  if (diff > 0) {
    return `${label}は昨日より+${diff}${suffix}向上しました。`;
  }

  if (diff < 0) {
    return `${label}は昨日より${diff}${suffix}低下しましたが、AIは新しいデータをもとに判断基準を調整しています。`;
  }

  return `${label}は昨日と同水準を維持しています。`;
}

export function generateAiComment(input: AiCommentInput): string {
  const qualityScore = toNumber(input.qualityScore);
  const overallWinRate = toNumber(input.overallWinRate);
  const processedCount = toNumber(input.processedCount);
  const winCount = toNumber(input.winCount);
  const loseCount = toNumber(input.loseCount);
  const holdCount = toNumber(input.holdCount);
  const changedWeight = toNumber(input.changedWeight);
  const patternCount = toNumber(input.patternCount);

  const comments: string[] = [];

  comments.push(
    `今日は${processedCount}件を学習し、新しい経験を積み重ねました。`
  );

  if (input.previous) {
    const prev = input.previous;

    comments.push(
      diffText(
        "予測的中率",
        overallWinRate,
        toNumber(prev.overallWinRate),
        "%"
      )
    );

    comments.push(
      diffText(
        "AI完成度",
        qualityScore,
        toNumber(prev.qualityScore),
        "%"
      )
    );

    const learningDiff =
      processedCount - toNumber(prev.processedCount);

    if (learningDiff > 0) {
      comments.push(
        `学習件数は昨日より+${learningDiff}件増え、AIはより多くの判断材料を得ました。`
      );
    } else if (learningDiff < 0) {
      comments.push(
        `学習件数は昨日より${learningDiff}件少なめでしたが、重要なデータを中心に確認しました。`
      );
    } else {
      comments.push(
        "学習件数は昨日と同じ水準で、安定した学習を継続しています。"
      );
    }

    const patternDiff =
      patternCount - toNumber(prev.patternCount);

    if (patternDiff > 0) {
      comments.push(
        `勝ちパターンは昨日より+${patternDiff}件増加し、AIの判断材料がさらに厚くなりました。`
      );
    } else if (patternDiff === 0) {
      comments.push(
        "勝ちパターン数は昨日と同水準で、既存の判断基準を確認しています。"
      );
    } else {
      comments.push(
        `勝ちパターン数は昨日より${patternDiff}件変化し、AIはパターンの見直しを行っています。`
      );
    }
  } else {
    if (overallWinRate >= 70) {
      comments.push("予測精度は高い水準で推移しています。");
    } else if (overallWinRate >= 55) {
      comments.push("予測精度は安定しています。");
    } else {
      comments.push(
        "予測精度にはまだ改善余地があり、AIは判断基準を調整しています。"
      );
    }
  }

  if (changedWeight > 0) {
    comments.push(`${changedWeight}項目の判断基準を見直しました。`);
  } else {
    comments.push("判断基準は大きく変えず、安定性を重視しました。");
  }

  if (winCount > loseCount) {
    comments.push(
      "WIN判定がLOSE判定を上回り、良い学習結果を確認できました。"
    );
  } else if (loseCount > winCount) {
    comments.push(
      "LOSE判定が多めでしたが、失敗パターンもAIにとって重要な学習材料です。"
    );
  } else if (holdCount > 0) {
    comments.push(
      "HOLD判定を多く確認し、慎重な判断が必要なパターンを蓄積しました。"
    );
  }

  if (qualityScore >= 95) {
    comments.push("現在のAIは最高評価を維持しています。");
  } else if (qualityScore >= 80) {
    comments.push("現在のAIは高い完成度を維持しています。");
  } else {
    comments.push("現在のAIは成長途中で、今後の学習による改善が期待できます。");
  }

  comments.push(
    "明日も継続して学習を行い、より賢いAIへ成長していきます。"
  );

  return comments.join(" ");
}