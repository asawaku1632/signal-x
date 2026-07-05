export function getCurrentTimeSlot(now: Date = new Date()) {
  const hh = now.getHours();
  const mm = now.getMinutes();
  const time = hh * 100 + mm;

  if (time >= 900 && time <= 1030) return "09:00-10:30";
  if (time >= 1031 && time <= 1130) return "10:31-11:30";
  if (time >= 1230 && time <= 1400) return "12:30-14:00";
  if (time >= 1401 && time <= 1500) return "14:01-15:00";

  return "OUT_OF_SESSION";
}