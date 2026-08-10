export const SAVE_SCHEDULE_LABEL = "15:35 JST";
export const SAVE_DELAY_THRESHOLD_SECONDS = 30 * 60;
export const RUNNING_GRACE_SECONDS = 5 * 60;

export type SaveMonitorClassification =
  | "NORMAL"
  | "CRON_NOT_STARTED"
  | "RUNNING"
  | "SCHEDULER_DELAY"
  | "SCAN_FAILED"
  | "DB_SAVE_FAILED"
  | "POST_SAVE_FAILED"
  | "CRON_STALLED";

export type MonitorLog = {
  status: string;
  createdAt: string | null;
  details: Record<string, unknown> | null;
};

function detailString(log: MonitorLog | null, key: string) {
  const value = log?.details?.[key];
  return typeof value === "string" ? value : null;
}

function detailNumber(log: MonitorLog | null, key: string) {
  const value = Number(log?.details?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function logTime(log: MonitorLog | null) {
  return log?.createdAt ? new Date(log.createdAt).getTime() : 0;
}

function runId(log: MonitorLog | null) {
  return detailString(log, "runId");
}

export function classifyLearningSave(input: {
  savedCount: number;
  logs: MonitorLog[];
  nowMs: number;
}) {
  const latest = input.logs[0] ?? null;
  const latestError = input.logs.find((log) => log.status === "ERROR") ?? null;
  const latestReceived = input.logs.find(
    (log) => log.status === "RECEIVED" || log.status === "STARTED",
  ) ?? null;
  const completed = input.logs.find((log) => log.status === "COMPLETED") ?? null;
  const completedRunId = runId(completed);
  const received =
    input.logs.find(
      (log) =>
        (log.status === "RECEIVED" || log.status === "STARTED") &&
        completedRunId &&
        runId(log) === completedRunId,
    ) ?? latestReceived;
  const error =
    latestError && (!completed || logTime(latestError) > logTime(completed))
      ? latestError
      : null;
  const latestRunId = runId(latestReceived);
  const latestRunLogs = latestRunId
    ? input.logs.filter((log) => runId(log) === latestRunId)
    : [];
  const latestRunTerminal = latestRunLogs.some((log) =>
    ["COMPLETED", "ERROR", "SKIPPED"].includes(log.status),
  );
  const stage = detailString(error, "stage");
  const delaySeconds = detailNumber(received, "delaySeconds");
  const latestAgeSeconds = latest?.createdAt
    ? Math.max(0, Math.floor((input.nowMs - new Date(latest.createdAt).getTime()) / 1000))
    : Number.POSITIVE_INFINITY;

  let classification: SaveMonitorClassification;
  if (error && stage === "related-learning-save" && input.savedCount > 0) {
    classification = "POST_SAVE_FAILED";
  } else if (error && (stage === "scan" || stage === "scan-response")) {
    classification = "SCAN_FAILED";
  } else if (error && stage === "daily-stock-save") {
    classification = "DB_SAVE_FAILED";
  } else if (input.savedCount > 0 && completed) {
    classification =
      delaySeconds >= SAVE_DELAY_THRESHOLD_SECONDS ? "SCHEDULER_DELAY" : "NORMAL";
  } else if (!latestReceived) {
    classification = "CRON_NOT_STARTED";
  } else if (!latestRunTerminal && latestAgeSeconds <= RUNNING_GRACE_SECONDS) {
    classification = "RUNNING";
  } else {
    classification = "CRON_STALLED";
  }

  return {
    classification,
    latest,
    received,
    completed,
    error,
    stage,
    delaySeconds,
    latestAgeSeconds,
  };
}
