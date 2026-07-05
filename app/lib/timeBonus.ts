export function getTimeBonus(now: Date = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;

  // 09:00〜10:30 朝の初動
  if (time >= 9 * 60 && time <= 10 * 60 + 30) {
    return 3;
  }

  // 10:31〜11:30 前場後半
  if (time >= 10 * 60 + 31 && time <= 11 * 60 + 30) {
    return 1;
  }

  // 12:30〜14:00 後場前半
  if (time >= 12 * 60 + 30 && time <= 14 * 60) {
    return 2;
  }

  // 14:01〜15:00 大引け前
  if (time >= 14 * 60 + 1 && time <= 15 * 60) {
    return -1;
  }

  return 0;
}