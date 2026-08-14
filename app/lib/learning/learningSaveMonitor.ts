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

function runId(log: MonitorLog | null) {
  return detailString(log, "runId");
}

function isAlreadyRunningSkip(log: MonitorLog) {
  return log.status === "SKIPPED" && detailString(log, "reason") === "ALREADY_RUNNING";
}

export function classifyLearningSave(input: {
  savedCount: number;
  logs: MonitorLog[];
  nowMs: number;
}) {
  const skippedRunIds = new Set(
    input.logs.filter(isAlreadyRunningSkip).map((log) => runId(log)).filter(Boolean),
  );
  const executionStart = input.logs.find(
    (log) => log.status === "STARTED" && Boolean(runId(log)) && !skippedRunIds.has(runId(log)),
  ) ?? null;
  const fallbackReceived = input.logs.find(
    (log) => log.status === "RECEIVED" && Boolean(runId(log)) && !skippedRunIds.has(runId(log)),
  ) ?? null;
  const received = executionStart ?? fallbackReceived;
  const executionRunId = runId(received);
  const latestRunLogs = executionRunId
    ? input.logs.filter((log) => runId(log) === executionRunId)
    : [];
  const latest = latestRunLogs[0] ?? received ?? input.logs[0] ?? null;
  const completed = latestRunLogs.find((log) => log.status === "COMPLETED") ?? null;
  const error = latestRunLogs.find((log) => log.status === "ERROR") ?? null;
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
  } else if (!received) {
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
