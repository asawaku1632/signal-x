// Pure display classification. Never derives returns or changes persisted data.
export function classifyResearchCheckpoint(status, targetDate, ready) {
  if (status !== "PENDING_OR_MISSING") return status;
  if (!targetDate) return "CALENDAR_UNAVAILABLE";
  return ready === true ? "MISSING" : "NOT_YET_DUE";
}

export function tokyoDateOnly(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_TIMESTAMP");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return [part("year"), part("month"), part("day")].join("-");
}
