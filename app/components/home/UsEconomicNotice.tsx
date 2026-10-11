"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nextUsEconomicEvent } from "@/app/lib/usEconomicEvents";

const japanTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default function UsEconomicNotice() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const next = now === null ? undefined : nextUsEconomicEvent(new Date(now));
  const hoursUntil = next && now !== null
    ? (Date.parse(next.scheduledAt) - now) / 3_600_000
    : null;
  const caution = hoursUntil !== null && hoursUntil <= 72;

  return (
    <Link href="/economic-events" className={
      "mb-2 block rounded-2xl border p-3 shadow-sm " +
      (caution ? "border-amber-300 bg-amber-50" : "border-sky-200 bg-sky-50")
    }>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-wide text-slate-600">
            🇺🇸 米国経済イベント
          </p>
          {next ? (
            <>
              <p className="mt-1 text-sm font-black text-slate-900">{next.title}</p>
              <p className="text-xs font-bold text-slate-700">
                {japanTime.format(new Date(next.scheduledAt))}（日本時間）
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                {caution
                  ? "発表が近づいています。株価・為替の急変に注意"
                  : "今後の重要指標を確認・発表前後の市場を記録"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs font-bold text-slate-700">
              {now === null ? "発表日程を確認中…" : "公開済みの日程は終了。公式日程を確認してください"}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xl text-sky-700" aria-hidden="true">›</span>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        参考情報のみ・AI POWERと売買判定は変更しません
      </p>
    </Link>
  );
}
