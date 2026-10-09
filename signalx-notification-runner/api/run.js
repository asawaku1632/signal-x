const TARGET = "https://signal-x-ppjg.vercel.app";

const JOBS = {
  "prime-signal": "/api/cron/prime-signal",
  "favorite-ai-monitor": "/api/cron/favorite-ai-monitor",
  "favorite-ai-check": "/api/cron/favorite-ai-check",
  "golden-zone-0930": "/api/cron/golden-zone?slot=0930",
  "golden-zone-1030": "/api/cron/golden-zone?slot=1030",
  "golden-zone-1300": "/api/cron/golden-zone?slot=1300",
  "golden-zone-1430": "/api/cron/golden-zone?slot=1430",
};

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const runnerSecret = process.env.NOTIFICATION_RUNNER_SECRET;

  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!runnerSecret) {
    return res.status(500).json({
      success: false,
      error: "NOTIFICATION_RUNNER_SECRET is not configured",
    });
  }

  const job = typeof req.query.job === "string" ? req.query.job : "";
  const path = JOBS[job];

  if (!path) {
    return res.status(400).json({ success: false, error: "Unknown notification job" });
  }

  try {
    const response = await fetch(TARGET + path, {
      headers: { authorization: `Bearer ${runnerSecret}` },
    });
    const body = await response.text();
    return res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      job,
      path,
      status: response.status,
      body: body.slice(0, 1000),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      job,
      path,
      status: 0,
      error: String(error),
    });
  }
}
