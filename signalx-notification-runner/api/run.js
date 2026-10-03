const TARGET = "https://signal-x-ppjg.vercel.app";

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

  const jobs = [
    "/api/cron/prime-signal",
    "/api/cron/favorite-ai-monitor",
    "/api/cron/favorite-ai-check",
  ];

  const results = [];
  for (const path of jobs) {
    try {
      const response = await fetch(TARGET + path, {
        headers: { authorization: `Bearer ${runnerSecret}` },
      });
      const body = await response.text();
      results.push({
        path,
        status: response.status,
        ok: response.ok,
        body: body.slice(0, 1000),
      });
    } catch (error) {
      results.push({ path, status: 0, ok: false, error: String(error) });
    }
  }

  const ok = results.every((item) => item.ok);
  return res.status(ok ? 200 : 502).json({ success: ok, results });
}
