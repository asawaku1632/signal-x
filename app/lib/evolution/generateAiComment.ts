type GenerateAiCommentInput = {
  qualityScore: number;
  overallWinRate: number;
  processedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  changedWeight: number;
  patternCount: number;
};

export function generateAiComment(input: GenerateAiCommentInput) {
  const messages: string[] = [];

  // 学習件数
  if (input.processedCount >= 100) {
    messages.push(
      `今日は${input.processedCount}件もの学習を行い、大量の経験を蓄積しました。`
    );
  } else if (input.processedCount >= 20) {
    messages.push(
      `今日は${input.processedCount}件を学習し、新しい経験を積み重ねました。`
    );
  } else {
    messages.push(
      `今日は${input.processedCount}件の学習を行いました。`
    );
  }

  // 勝率
  if (input.overallWinRate >= 80) {
    messages.push(
      "予測精度は非常に高い状態を維持しています。"
    );
  } else if (input.overallWinRate >= 70) {
    messages.push(
      "予測精度は順調に推移しています。"
    );
  } else if (input.overallWinRate >= 60) {
    messages.push(
      "予測精度は安定しています。"
    );
  } else {
    messages.push(
      "今後さらに学習を重ねて精度向上を目指します。"
    );
  }

  // 改善数
  if (input.changedWeight >= 10) {
    messages.push(
      `今日は${input.changedWeight}項目の判断基準を改善しました。`
    );
  } else if (input.changedWeight > 0) {
    messages.push(
      `${input.changedWeight}項目の判断基準を見直しました。`
    );
  }

  // WIN / LOSE
  if (input.winCount > input.loseCount * 3) {
    messages.push(
      "勝ちパターンを多く確認できたため、判断力がさらに向上しています。"
    );
  } else if (input.loseCount > input.winCount) {
    messages.push(
      "負けパターンも重要な学習材料として次回以降へ反映します。"
    );
  }

  // AI品質
  if (input.qualityScore === 100) {
    messages.push(
      "現在のAIは最高評価を維持しています。"
    );
  }

  messages.push("明日も継続して学習を行い、より賢いAIへ成長していきます。");

  return messages.join(" ");
}