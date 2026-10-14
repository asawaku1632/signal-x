/** Owner-only external forecast archive. No network calls, no market scoring. */
const trim = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max + 1) : "";
const realDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
const quoteCode = value => /^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(value);
export function wasArchivedBeforeOpen(tradeDate, archivedAt) {
  if (!realDate(tradeDate)) return false;
  const recorded = Date.parse(archivedAt);
  if (!Number.isFinite(recorded)) return false;
  return recorded < Date.parse(tradeDate + "T09:00:00+09:00");
}

/** Does NOT verify the original post's publication timestamp or accuracy. */
export function validateExternalArchive(form, now = new Date()) {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return {ok:false, error:"INVALID_CLOCK"};
  const tradeDate = trim(form.tradeDate, 10);
  const code = trim(form.code, 4).toUpperCase();
  const providerName = trim(form.providerName, 60);
  const stockName = trim(form.stockName, 80);
  const buyLimitText = trim(form.buyLimit, 24);
  const originalPostUrl = trim(form.originalPostUrl, 1800);
  const publishedInput = trim(form.publishedAtJst, 16);
  const sourceNote = trim(form.sourceNote, 400);
  if (!realDate(tradeDate) ||
      Date.parse(tradeDate + "T00:00:00+09:00") > nowMs + 370 * 86400000 ||
      Date.parse(tradeDate + "T00:00:00+09:00") < Date.parse("2020-01-01T00:00:00+09:00")) {
    return {ok:false, error:"INVALID_TRADE_DATE"};
  }
  if (!quoteCode(code) || !providerName || providerName.length > 60 ||
      !stockName || stockName.length > 80) return {ok:false, error:"INVALID_STOCK_OR_PROVIDER"};
  if (!/^\d{1,8}(?:\.\d{1,3})?$/.test(buyLimitText))
    return {ok:false, error:"INVALID_BUY_LIMIT"};
  const buyLimit = Number(buyLimitText);
  if (!Number.isFinite(buyLimit) || buyLimit <= 0) return {ok:false, error:"INVALID_BUY_LIMIT"};
  if (originalPostUrl) {
    try {
      const url = new URL(originalPostUrl);
      if (url.protocol !== "https:" || !url.hostname.includes(".") ||
          url.username || url.password || originalPostUrl.length > 1800)
        return {ok:false, error:"INVALID_SOURCE_URL"};
    } catch { return {ok:false, error:"INVALID_SOURCE_URL"}; }
  }
  let claimedPublishedAt = null;
  if (publishedInput) {
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(publishedInput) ||
        !realDate(publishedInput.slice(0,10)))
      return {ok:false, error:"INVALID_PUBLISHED_AT"};
    const millis = Date.parse(publishedInput + ":00+09:00");
    if (!Number.isFinite(millis) || millis > nowMs)
      return {ok:false, error:"INVALID_PUBLISHED_AT"};
    claimedPublishedAt = new Date(millis).toISOString();
  }
  if (sourceNote.length > 400) return {ok:false, error:"INVALID_NOTE"};
  return {ok:true,value:{
    tradeDate, code, providerName, stockName, buyLimit,
    originalPostUrl:originalPostUrl||null,
    claimedPublishedAt, sourceNote:sourceNote||null
  }};
}
