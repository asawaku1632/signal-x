const INTERVAL_MS = 5 * 60 * 1000;
const SCAN_URL = "http://localhost:3000/api/scan";

async function runScan() {
  const now = new Date().toLocaleString("ja-JP");

  try {
    console.log(`[${now}] SIGNALX 自動スキャン開始`);

    const res = await fetch(SCAN_URL);

    if (!res.ok) {
      console.log(`[${now}] 失敗: ${res.status}`);
      return;
    }

    const json = await res.json();

    const count = json.stocks?.length || 0;

    console.log(`[${now}] 保存完了: ${count}銘柄スキャン`);
  } catch (error) {
    console.log(`[${now}] エラー`, error);
  }
}

runScan();

setInterval(() => {
  runScan();
}, INTERVAL_MS);