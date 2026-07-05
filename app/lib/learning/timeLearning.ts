import pool from "@/app/lib/postgres";
import { getTimeBonus } from "@/app/lib/timeBonus";

export function getCurrentTimeSlot() {
  const now = new Date();

  const hh = now.getHours();
  const mm = now.getMinutes();
  const time = hh * 100 + mm;

  if (time >= 900 && time <= 1030) return "09:00-10:30";
  if (time >= 1031 && time <= 1130) return "10:31-11:30";
  if (time >= 1230 && time <= 1400) return "12:30-14:00";
  if (time >= 1401 && time <= 1500) return "14:01-15:00";

  return "OUT_OF_SESSION";
}

export function calculateTimeLearningBonus(
  winRate: number,
  confidence: number
) {
  if (confidence < 50) return 0;

  if (winRate >= 80) return 4;
  if (winRate >= 70) return 2;
  if (winRate >= 60) return 1;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -2;

  return -4;
}

export async function getLearningTimeBonus() {
  const currentSlot = getCurrentTimeSlot();

  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
      COUNT(*) FILTER (WHERE result != 'PENDING')::int AS judged
    FROM time_learning_logs
    WHERE time_slot = $1
    `,
    [currentSlot]
  );

  const win = Number(rows[0]?.win ?? 0);
  const judged = Number(rows[0]?.judged ?? 0);
  const winRate =
    judged > 0 ? Number(((win / judged) * 100).toFixed(2)) : 0;

  const confidence =
    judged >= 300 ? 100 :
    judged >= 100 ? 80 :
    judged >= 30 ? 60 :
    judged >= 10 ? 40 :
    0;

  return {
    timeSlot: currentSlot,
    bonus:
      confidence >= 40
        ? calculateTimeLearningBonus(winRate, confidence)
        : getTimeBonus(),
    winRate,
    judged,
    confidence,
    source: confidence >= 40 ? "learning" : "fixed",
  };
}