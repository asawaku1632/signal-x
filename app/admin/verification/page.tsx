"use client";

import Link from "next/link";
import { useState } from "react";

type VerificationError = {
  code?: string;
  name?: string;
  reason: string;
};

type MissingStock = {
  code: string;
  name: string;
  reason: string;
};

type VerificationResult = {
  success: boolean;
  status: "PASS" | "FAIL" | "ERROR";
  checkedAt?: string;
  scanSuccess?: boolean;
  cached?: boolean;
  fallback?: boolean;
  debugVersion?: string;
  acquisitionRate?: number;
  requestedLimit?: number;
  totalStockList?: number | null;
  stockCount?: number;
  missingCount?: number;
  missingStocks?: MissingStock[];
  validCode?: number;
  validName?: number;
  validPrice?: number;
  validScore?: number;
  validReason?: number;
  errorCount?: number;
  errors?: VerificationError[];
  error?: string;
};

function recommendationColorClass(evaluation?: string) {
  if (evaluation === "STRONG_BUY") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (evaluation === "BUY") return "text-green-700 bg-green-50 border-green-200";
  if (evaluation === "SLIGHT_BUY") return "text-lime-700 bg-lime-50 border-lime-200";
  if (evaluation === "KEEP") return "text-orange-700 bg-orange-50 border-orange-200";
  if (evaluation === "WEAK") return "text-amber-700 bg-amber-50 border-amber-200";
  if (evaluation === "AVOID") return "text-red-700 bg-red-50 border-red-200";
  if (evaluation === "NOT_ENOUGH_DATA") return "text-slate-700 bg-slate-50 border-slate-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatRate(value?: number | string | null) {
  if (value === undefined || value === null) return "-";

  const raw = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(raw)) return "-";

  const percent = raw <= 1 ? raw * 100 : raw;
  return `${percent.toFixed(2)}%`;
}

function cronLabel(status?: string) {
  if (status === "SUCCESS") return "正常動作中";
  if (status === "NO_DATA") return "通知なし";
  if (!status) return "未確認";
  return "確認が必要";
}

function phaseStatus(ok: boolean, warning?: boolean) {
  if (warning) {
    return {
      icon: "🟠",
      label: "NO DATA",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (ok) {
    return {
      icon: "✅",
      label: "PASS",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    icon: "⏳",
    label: "CHECK",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export default function VerificationPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [technicalResult, setTechnicalResult] = useState<any>(null);

  const [aiPowerResult, setAiPowerResult] = useState<any>(null);
  const [aiPowerLoading, setAiPowerLoading] = useState(false);

  const [learningResult, setLearningResult] = useState<any>(null);
  const [learningLoading, setLearningLoading] = useState(false);

  const [lineResult, setLineResult] = useState<any>(null);
  const [lineLoading, setLineLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [evolutionHistory, setEvolutionHistory] = useState<any[]>([]);
  const [dailyReports, setDailyReports] = useState<any[]>([]);

  async function runAiPowerVerification() {
    setAiPowerLoading(true);

    try {
      const res = await fetch("/api/verification/ai-power", {
        cache: "no-store",
      });

      const data = await res.json();
      setAiPowerResult(data);
      return data;
    } catch {
      const data = {
        success: false,
        status: "FAIL",
        error: "AI_POWER_VERIFICATION_FAILED",
      };
      setAiPowerResult(data);
      return data;
    } finally {
      setAiPowerLoading(false);
    }
  }

  async function runLearningVerification() {
    setLearningLoading(true);

    try {
      const res = await fetch("/api/verification/learning", {
        cache: "no-store",
      });

      const data = await res.json();
      setLearningResult(data);
      return data;
    } catch {
      const data = {
        success: false,
        status: "FAIL",
        error: "LEARNING_VERIFICATION_FAILED",
      };
      setLearningResult(data);
      return data;
    } finally {
      setLearningLoading(false);
    }
  }

  async function runLineVerification() {
    setLineLoading(true);

    try {
      const res = await fetch("/api/verification/line", {
        cache: "no-store",
      });

      const data = await res.json();
      setLineResult(data);
      return data;
    } catch {
      const data = {
        success: false,
        status: "FAIL",
        error: "LINE_VERIFICATION_FAILED",
      };
      setLineResult(data);
      return data;
    } finally {
      setLineLoading(false);
    }
  }

  const runVerification = async () => {
    setLoading(true);
    setResult(null);
    setTechnicalResult(null);
    setAiPowerResult(null);
    setLearningResult(null);
    setLineResult(null);

    try {
      const res = await fetch("/api/verification/run", {
        cache: "no-store",
      });

      const data = await res.json();
      setResult(data);

      const technicalRes = await fetch("/api/verification/technical?limit=100", {
        cache: "no-store",
      });

      const technicalData = await technicalRes.json();
      setTechnicalResult(technicalData);

      const recommendationRes = await fetch(
        "/api/ai-power/recommendations/list",
        { cache: "no-store" }
      );

      const recommendationData = await recommendationRes.json();
      setRecommendations(recommendationData.recommendations ?? []);

      const evolutionRes = await fetch("/api/ai-power/evolution-history", {
        cache: "no-store",
      });

      const evolutionData = await evolutionRes.json();
      setEvolutionHistory(evolutionData.history ?? []);

      const reportRes = await fetch("/api/ai-power/daily-report/history", {
        cache: "no-store",
      });

      const reportData = await reportRes.json();
      setDailyReports(reportData.history ?? []);

      await Promise.all([
        runAiPowerVerification(),
        runLearningVerification(),
        runLineVerification(),
      ]);
    } catch (error) {
      setResult({
        success: false,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const phase1Ok = result?.status === "PASS";
  const phase2Ok =
    technicalResult?.status === "PASS" ||
    technicalResult?.failCount === 0 ||
    technicalResult?.matchRate >= 99;
  const phase3Ok = aiPowerResult?.status === "PASS";
  const phase4Ok = learningResult?.status === "PASS";
  const phase5Ok =
    lineResult?.status === "PASS" || lineResult?.status === "NO_DATA";
  const phase6Ok = recommendations.length > 0;
  const phase7Ok = evolutionHistory.length > 0;
  const phase8Ok = dailyReports.length > 0;

  const allRequiredOk =
    phase1Ok &&
    phase2Ok &&
    phase3Ok &&
    phase4Ok &&
    phase5Ok &&
    phase6Ok &&
    phase7Ok &&
    phase8Ok;

  const hasAnyFail =
    result?.status === "FAIL" ||
    result?.status === "ERROR" ||
    technicalResult?.status === "FAIL" ||
    aiPowerResult?.status === "FAIL" ||
    learningResult?.status === "FAIL" ||
    lineResult?.status === "FAIL";

  const qaStatus = hasAnyFail
    ? "NOT READY"
    : allRequiredOk
    ? "READY FOR RELEASE"
    : "CHECKING";

  const qaStatusIcon = hasAnyFail ? "🔴" : allRequiredOk ? "🟢" : "🟡";
  const qaStatusClass = hasAnyFail
    ? "border-red-200 bg-red-50 text-red-700"
    : allRequiredOk
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-orange-200 bg-orange-50 text-orange-700";

  const latestReport = dailyReports[dailyReports.length - 1];

  const phases = [
    {
      no: "01",
      title: "データ取得監査",
      description: "1000銘柄スキャンと取得率を確認",
      detail: result ? `取得率 ${formatRate(result.acquisitionRate)}` : "検証開始で確認",
      ...phaseStatus(phase1Ok),
    },
    {
      no: "02",
      title: "テクニカル監査",
      description: "価格・指標・判定整合性を確認",
      detail: technicalResult ? `一致率 ${formatRate(technicalResult.matchRate)}` : "検証開始で確認",
      ...phaseStatus(phase2Ok),
    },
    {
      no: "03",
      title: "AI POWER監査",
      description: "AI POWER計算とスコア品質を確認",
      detail: aiPowerResult?.status ?? "単独監査OK",
      ...phaseStatus(phase3Ok),
    },
    {
      no: "04",
      title: "AI学習監査",
      description: "学習ログと勝敗判定を確認",
      detail: learningResult?.status ?? "単独監査OK",
      ...phaseStatus(phase4Ok),
    },
    {
      no: "05",
      title: "LINE通知監査",
      description: "通知可否と通知なし日を確認",
      detail: lineResult?.status === "NO_DATA" ? "通知なし日は正常扱い" : lineResult?.status ?? "単独監査OK",
      ...phaseStatus(phase5Ok, lineResult?.status === "NO_DATA"),
    },
    {
      no: "06",
      title: "AI提案監査",
      description: "AI Recommendationの生成を確認",
      detail: `${formatNumber(recommendations.length)}件`,
      ...phaseStatus(phase6Ok),
    },
    {
      no: "07",
      title: "AI進化履歴",
      description: "AI Evolution Historyの保存を確認",
      detail: `${formatNumber(evolutionHistory.length)}件`,
      ...phaseStatus(phase7Ok),
    },
    {
      no: "08",
      title: "AI日次レポート",
      description: "Daily Reportの保存を確認",
      detail: `${formatNumber(dailyReports.length)}件`,
      ...phaseStatus(phase8Ok),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-20 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white bg-white/85 p-5 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-black text-blue-600">
              ← SIGNALX Home
            </Link>

            <p className="mt-5 text-xs font-black tracking-[0.2em] text-blue-600">
              QA CENTER
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Verification Center
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-600">
              Google Play公開前の品質保証チェック。データ取得、AI POWER、学習、
              LINE通知、AI進化履歴、日次レポートをまとめて監査します。
            </p>
          </div>

          <div className={`rounded-[2rem] border px-5 py-4 text-center ${qaStatusClass}`}>
            <p className="text-xs font-black tracking-[0.18em]">RELEASE STATUS</p>
            <p className="mt-2 text-2xl font-black">
              {qaStatusIcon} {qaStatus}
            </p>
          </div>
        </header>

        <section className="mb-6 rounded-[2.25rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-2xl shadow-blue-200 md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-blue-200">
                GOOGLE PLAY RELEASE QA
              </p>

              <h2 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
                公開前品質を
                <br />
                AIで最終確認。
              </h2>

              <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-blue-100">
                必須フェーズをすべて確認し、ユーザーに出しても問題ない状態かを判断します。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:w-[360px]">
              <HeroMini label="取得率" value={formatRate(result?.acquisitionRate)} />
              <HeroMini label="取得済み" value={formatNumber(result?.stockCount)} />
              <HeroMini label="AI提案" value={formatNumber(recommendations.length)} />
              <HeroMini label="日次レポート" value={formatNumber(dailyReports.length)} />
            </div>
          </div>

          <div className="relative z-40 mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionButton
              label={loading ? "検証中..." : "🚀 検証開始"}
              onClick={runVerification}
              disabled={loading}
              className="bg-white text-blue-700 hover:bg-blue-50 lg:col-span-1"
              large
            />

            <ActionButton
              label={aiPowerLoading ? "AI POWER監査中..." : "AI POWER監査"}
              onClick={runAiPowerVerification}
              disabled={aiPowerLoading}
              className="bg-blue-500 text-white hover:bg-blue-400"
            />

            <ActionButton
              label={learningLoading ? "AI学習監査中..." : "AI学習監査"}
              onClick={runLearningVerification}
              disabled={learningLoading}
              className="bg-emerald-500 text-white hover:bg-emerald-400"
            />

            <ActionButton
              label={lineLoading ? "LINE監査中..." : "LINE通知監査"}
              onClick={runLineVerification}
              disabled={lineLoading}
              className="bg-green-500 text-white hover:bg-green-400"
            />
          </div>
        </section>

        <section className="mb-6 rounded-[2rem] border border-white bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                QA PHASES
              </p>
              <h2 className="mt-2 text-3xl font-black">品質保証フェーズ</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                Phase1〜8の通過状況をカードで確認できます。
              </p>
            </div>

            <p className={`w-fit rounded-full border px-4 py-2 text-sm font-black ${qaStatusClass}`}>
              {qaStatusIcon} {qaStatus}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((phase) => (
              <div
                key={phase.no}
                className={`rounded-[1.5rem] border p-4 ${phase.className}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-[0.18em]">
                    PHASE {phase.no}
                  </p>
                  <span className="text-xl">{phase.icon}</span>
                </div>

                <h3 className="mt-3 text-lg font-black">{phase.title}</h3>
                <p className="mt-2 text-xs font-bold leading-5 opacity-80">
                  {phase.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <p className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-black">
                    {phase.label}
                  </p>
                  <p className="w-fit rounded-full bg-white/60 px-3 py-1 text-xs font-black">
                    {phase.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon="📊"
            title="データ取得率"
            value={formatRate(result?.acquisitionRate)}
            caption={`取得済み ${formatNumber(result?.stockCount)} / 要求 ${formatNumber(result?.requestedLimit)}`}
          />
          <KpiCard
            icon="🧠"
            title="AI提案"
            value={formatNumber(recommendations.length)}
            caption="AI Recommendationの件数"
          />
          <KpiCard
            icon="📈"
            title="進化履歴"
            value={formatNumber(evolutionHistory.length)}
            caption="AIが判断基準を見直した履歴"
          />
          <KpiCard
            icon="✅"
            title="日次レポート"
            value={formatNumber(dailyReports.length)}
            caption={latestReport ? `最新 ${formatDate(latestReport.report_date)}` : "未取得"}
          />
        </section>

        {result?.error && (
          <section className="mb-6 rounded-[2rem] border border-red-200 bg-red-50 p-5 text-red-800">
            <h2 className="text-xl font-black">エラー</h2>
            <p className="mt-2 text-sm font-bold">{result.error}</p>
          </section>
        )}

        {result && (
          <section className="mb-6 rounded-[2rem] border border-white bg-white p-5 shadow-sm md:p-6">
            <p className="text-xs font-black tracking-[0.18em] text-blue-600">
              PHASE 1 DETAIL
            </p>
            <h2 className="mt-2 text-2xl font-black">データ取得監査</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniStat label="実行時刻" value={formatDateTime(result.checkedAt)} />
              <MiniStat label="Debug Version" value={result.debugVersion ?? "-"} />
              <MiniStat label="総合判定" value={result.status} />
              <MiniStat label="Scan成功" value={result.scanSuccess ? "true" : "false"} />
              <MiniStat label="Cache使用" value={result.cached ? "true" : "false"} />
              <MiniStat label="Fallback使用" value={result.fallback ? "true" : "false"} />
              <MiniStat label="登録銘柄総数" value={formatNumber(result.totalStockList)} />
              <MiniStat label="取得銘柄数" value={formatNumber(result.stockCount)} />
              <MiniStat label="未取得銘柄数" value={formatNumber(result.missingCount)} />
            </div>
          </section>
        )}

        {evolutionHistory.length > 0 && (
          <section className="mb-6 rounded-[2rem] border border-white bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                  AI EVOLUTION HISTORY
                </p>
                <h2 className="mt-2 text-2xl font-black">🧠 AI進化履歴</h2>
              </div>
              <p className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                {formatNumber(evolutionHistory.length)}件
              </p>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {evolutionHistory.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-400">
                        {formatDateTime(item.applied_at)}
                      </p>
                      <h3 className="mt-2 text-lg font-black">
                        {item.rule_type} / {item.rule_key}
                      </h3>
                    </div>
                    <p className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">
                      勝率 {item.win_rate}%
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <MiniBox label="変更" value={`${item.old_bonus} → ${item.new_bonus}`} />
                    <MiniBox label="件数" value={String(item.sample_count)} />
                    <MiniBox label="種類" value={item.rule_type ?? "-"} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="mb-6 rounded-[2rem] border border-white bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                  AI RECOMMENDATION
                </p>
                <h2 className="mt-2 text-2xl font-black">🤖 AI提案監査</h2>
              </div>
              <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                {formatNumber(recommendations.length)}件
              </p>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {recommendations.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-400">
                        PATTERN
                      </p>
                      <h3 className="mt-2 text-lg font-black">
                        {item.pattern_key}
                      </h3>
                    </div>

                    <p
                      className={`rounded-full border px-3 py-1 text-xs font-black ${recommendationColorClass(
                        item.evaluation
                      )}`}
                    >
                      {item.evaluation}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <MiniBox label="現在" value={String(item.current_bonus)} />
                    <MiniBox
                      label="AI提案"
                      value={`${item.recommended_bonus > 0 ? "+" : ""}${item.recommended_bonus}`}
                    />
                    <MiniBox label="勝率" value={`${item.win_rate}%`} />
                    <MiniBox label="件数" value={String(item.sample_count)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {latestReport && (
          <section className="mb-6 rounded-[2rem] border border-white bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                  AI DAILY REPORT
                </p>
                <h2 className="mt-2 text-2xl font-black">📈 AI日次レポート</h2>
              </div>
              <p className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                {latestReport.qa_status}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <ReportCard title="Health" value={latestReport.health_score} />
              <ReportCard title="Acquisition" value={formatRate(latestReport.acquisition_rate)} />
              <ReportCard title="Evolution" value={latestReport.evolution_count} />
              <ReportCard title="QA" value={latestReport.qa_status} />
            </div>

            <div className="mt-5 space-y-3">
              {dailyReports.slice(-8).reverse().map((r) => (
                <div
                  key={r.id}
                  className="grid gap-3 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 text-sm font-bold md:grid-cols-6"
                >
                  <div>
                    <p className="text-xs text-slate-400">日付</p>
                    <p>{formatDate(r.report_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Health</p>
                    <p>{r.health_score}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">取得率</p>
                    <p>{formatRate(r.acquisition_rate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">提案</p>
                    <p>{r.generated_recommendations}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">反映</p>
                    <p>{r.applied_recommendations}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">進化</p>
                    <p>{r.evolution_count}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result?.errors && result.errors.length > 0 && (
          <section className="rounded-[2rem] border border-red-200 bg-red-50 p-5 text-red-800">
            <h2 className="text-xl font-black">検証エラー一覧</h2>

            <div className="mt-4 space-y-3">
              {result.errors.map((error, index) => (
                <div key={`${error.code}-${index}`} className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-black">
                    {error.code ?? "-"} {error.name ?? ""}
                  </p>
                  <p className="mt-1 text-sm font-bold">{error.reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  className,
  large = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative z-50 min-h-[60px] w-full cursor-pointer touch-manipulation select-none rounded-full px-5 py-4 text-sm font-black shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
        large ? "text-base" : ""
      } ${className}`}
    >
      {label}
    </button>
  );
}

function HeroMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] bg-white/10 p-4 text-center backdrop-blur">
      <p className="text-xs font-black text-blue-100">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function KpiCard({
  icon,
  title,
  value,
  caption,
}: {
  icon: string;
  title: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-2xl">
          {icon}
        </div>
        <p className="text-sm font-black text-slate-500">{title}</p>
      </div>

      <p className="mt-5 text-4xl font-black">{value}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{caption}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function ReportCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-5 text-center">
      <p className="text-xs font-black text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-blue-600">{value}</p>
    </div>
  );
}
