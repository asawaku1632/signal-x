"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EvolutionSummary = {
  qualityScore?: number;
  qualityLabel?: string;
  judgedRecords?: number;
  overallWinRate?: number;
  patternCount?: number;
  activeWeightRules?: number;
  changedCount?: number;
  cronStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

type EvolutionSummaryResponse = {
  success?: boolean;
  checkedAt?: string;
  dataUpdatedAt?: string | null;
  latest?: EvolutionSummary | null;
  history?: EvolutionSummary[];
};

type TrustData = {
  qualityScore: number | null;
  qualityLabel: string;
  judgedRecords: number | null;
  overallWinRate: number | null;
  patternCount: number | null;
  activeWeightRules: number | null;
  changedCount: number | null;
  cronStatus: string;
  updatedAt: string | null;
};

const qualityItems = [
  {
    icon: "📡",
    title: "データ取得",
    description:
      "日本株の価格・出来高・テクニカル情報を継続的に取得し、AI判断の土台にします。",
  },
  {
    icon: "🧠",
    title: "AI POWER",
    description:
      "複数の指標を一つの数字にまとめ、初心者でも強弱を把握しやすくしています。",
  },
  {
    icon: "📚",
    title: "毎日の学習",
    description:
      "過去の判定結果をWIN・LOSE・HOLDとして蓄積し、次の判断に反映します。",
  },
  {
    icon: "🛡️",
    title: "品質監査",
    description:
      "データ取得、テクニカル、AI判断、学習、通知、画面表示を段階的に確認します。",
  },
];

const auditItems = [
  "データ取得監査",
  "テクニカル監査",
  "AI POWER監査",
  "AI学習監査",
  "通知監査",
  "AI提案監査",
  "AI進化履歴",
  "日次レポート",
];

function numberText(value: number | null, suffix = "") {
  if (value === null || Number.isNaN(value)) return "確認中";
  return `${Math.round(value).toLocaleString("ja-JP")}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return "最新データを確認中";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最新データを確認中";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusMessage(score: number | null) {
  if (score === null) {
    return "品質データを読み込んでいます。SIGNALXは複数の監査項目を通じて、日々の状態を確認しています。";
  }

  if (score >= 95) {
    return "現在のAI品質は非常に高い水準です。毎日の学習と監査を継続しています。";
  }

  if (score >= 85) {
    return "現在のAI品質は良好です。学習データの蓄積に合わせて、さらに安定性を高めています。";
  }

  if (score >= 70) {
    return "現在のAI品質は標準以上です。継続学習と品質監査を続けています。";
  }

  return "現在のAIは改善を継続しています。判断結果だけでなく、理由とリスクも確認してご利用ください。";
}

export default function TrustPage() {
  const [data, setData] = useState<TrustData>({
    qualityScore: null,
    qualityLabel: "QUALITY CHECK",
    judgedRecords: null,
    overallWinRate: null,
    patternCount: null,
    activeWeightRules: null,
    changedCount: null,
    cronStatus: "CHECKING",
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTrustData() {
      try {
        const response = await fetch("/api/evolution/summary?limit=30", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Evolution summary request failed: ${response.status}`,
          );
        }

        const evolutionJson =
          (await response.json()) as EvolutionSummaryResponse;

        const latest: EvolutionSummary | null =
          evolutionJson?.latest ?? evolutionJson?.history?.[0] ?? null;

        if (!active) return;

        setData({
          qualityScore:
            typeof latest?.qualityScore === "number"
              ? latest.qualityScore
              : null,
          qualityLabel: latest?.qualityLabel || "QUALITY CHECK",
          judgedRecords:
            typeof latest?.judgedRecords === "number"
              ? latest.judgedRecords
              : null,
          overallWinRate:
            typeof latest?.overallWinRate === "number"
              ? latest.overallWinRate
              : null,
          patternCount:
            typeof latest?.patternCount === "number"
              ? latest.patternCount
              : null,
          activeWeightRules:
            typeof latest?.activeWeightRules === "number"
              ? latest.activeWeightRules
              : null,
          changedCount:
            typeof latest?.changedCount === "number"
              ? latest.changedCount
              : null,
          cronStatus: latest?.cronStatus || "UNKNOWN",
          updatedAt:
            evolutionJson.dataUpdatedAt ??
            latest?.updatedAt ??
            latest?.createdAt ??
            null,
        });
      } catch (error) {
        console.error("trust center fetch error:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTrustData();

    return () => {
      active = false;
    };
  }, []);

  const message = useMemo(
    () => statusMessage(data.qualityScore),
    [data.qualityScore],
  );

  const qualityBar =
    data.qualityScore === null
      ? 0
      : Math.max(0, Math.min(100, data.qualityScore));

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl font-black shadow-sm"
            aria-label="Homeへ戻る"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black leading-none">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="mt-1 text-[10px] font-black tracking-[0.22em] text-slate-500">
              AI TRUST CENTER
            </div>
          </div>

          <Link
            href="/privacy"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow-sm"
            aria-label="プライバシーポリシー"
          >
            🔒
          </Link>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-[36px] border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-6 text-white shadow-lg shadow-blue-200/60 md:p-8">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/10" />

          <div className="relative">
            <div className="inline-flex rounded-full bg-white/15 px-3 py-2 text-xs font-black tracking-[0.16em] backdrop-blur">
              TRANSPARENCY & QUALITY
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight md:text-5xl">
              AIの中身を、
              <br />
              できるだけ分かりやすく。
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-blue-50 md:text-base">
              SIGNALXは、ただ銘柄を表示するだけではありません。
              データ取得、AI判断、学習結果、通知までを継続的に確認し、
              初心者でも安心して使える状態を目指しています。
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-blue-700">
                8段階の品質確認
              </span>
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-black backdrop-blur">
                毎日学習
              </span>
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-black backdrop-blur">
                判断理由を表示
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                  CURRENT AI QUALITY
                </p>
                <h2 className="mt-2 text-2xl font-black">現在のAI品質</h2>
              </div>

              <span className="rounded-full bg-green-50 px-3 py-2 text-xs font-black text-green-700">
                {loading ? "READING" : data.qualityLabel}
              </span>
            </div>

            <div className="mt-5 flex items-end gap-2">
              <p className="text-6xl font-black tracking-tight text-slate-900">
                {data.qualityScore === null
                  ? "--"
                  : Math.round(data.qualityScore)}
              </p>
              <p className="pb-2 text-xl font-black text-slate-400">/ 100</p>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                style={{ width: `${qualityBar}%` }}
              />
            </div>

            <p className="mt-4 text-sm font-bold leading-6 text-slate-600">
              {message}
            </p>

            <p className="mt-4 text-xs font-bold text-slate-400">
              最終更新：{formatDate(data.updatedAt)}
            </p>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                  LEARNING STATUS
                </p>
                <h2 className="mt-2 text-2xl font-black">AI学習データ</h2>
              </div>
              <span
                className={`rounded-full px-3 py-2 text-[10px] font-black ${
                  data.cronStatus === "SUCCESS"
                    ? "bg-green-400/15 text-green-300"
                    : "bg-amber-400/15 text-amber-300"
                }`}
              >
                {loading
                  ? "READING"
                  : data.cronStatus === "SUCCESS"
                    ? "正常動作中"
                    : data.cronStatus}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs font-black text-slate-400">
                  学習済みデータ
                </p>
                <p className="mt-2 text-2xl font-black">
                  {numberText(data.judgedRecords, "件")}
                </p>
              </div>

              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs font-black text-slate-400">予測的中率</p>
                <p className="mt-2 text-2xl font-black text-cyan-300">
                  {data.overallWinRate === null
                    ? "確認中"
                    : `${data.overallWinRate.toFixed(1)}%`}
                </p>
              </div>

              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs font-black text-slate-400">
                  勝ちパターン
                </p>
                <p className="mt-2 text-xl font-black text-green-300">
                  {numberText(data.activeWeightRules, "種類")}
                </p>
              </div>

              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs font-black text-slate-400">
                  今日改善した数
                </p>
                <p className="mt-2 text-xl font-black">
                  {numberText(data.changedCount, "ヶ所")}
                </p>
              </div>

              <div className="col-span-2 rounded-[22px] bg-white/10 p-4">
                <p className="text-xs font-black text-slate-400">
                  判定済みパターン
                </p>
                <p className="mt-2 text-xl font-black">
                  {numberText(data.patternCount, "件")}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs font-bold leading-5 text-slate-400">
              AI成長センターと同じ最新サマリーを表示しています。
              数値は毎営業日の自動学習後に更新されます。
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-blue-600">
              HOW SIGNALX WORKS
            </p>
            <h2 className="mt-2 text-2xl font-black">
              SIGNALXが確認していること
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              AI判断を出す前と出した後の両方を確認します。
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {qualityItems.map((item) => (
              <div
                key={item.title}
                className="rounded-[26px] border border-slate-100 bg-[#f8fafc] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-2xl shadow-sm">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-black">{item.title}</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                QUALITY AUDIT
              </p>
              <h2 className="mt-2 text-2xl font-black">8段階の品質確認</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
              ADMIN QA
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {auditItems.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-[22px] bg-slate-50 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-black text-green-700">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{item}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    継続確認対象
                  </p>
                </div>
                <span className="text-lg">✓</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[32px] border border-amber-100 bg-amber-50 p-5 shadow-sm md:p-6">
          <p className="text-xs font-black tracking-[0.18em] text-amber-700">
            IMPORTANT
          </p>
          <h2 className="mt-2 text-2xl font-black">
            AIは利益を保証するものではありません
          </h2>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
            SIGNALXは投資判断を補助する情報ツールです。 AI
            POWER、勝率、利確・損切ラインは将来の結果を保証するものではありません。
            最終的な売買判断は、株価、必要資金、ご自身のリスク許容度を確認したうえで行ってください。
          </p>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <Link
            href="/scan-mobile"
            className="rounded-[26px] bg-blue-600 p-5 text-white shadow-sm transition active:scale-[0.99]"
          >
            <p className="text-xs font-black text-blue-100">AI SCAN</p>
            <p className="mt-2 text-lg font-black">AIランキングを見る</p>
            <p className="mt-4 text-2xl">→</p>
          </Link>

          <Link
            href="/admin/evolution"
            className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition active:scale-[0.99]"
          >
            <p className="text-xs font-black text-blue-600">AI EVOLUTION</p>
            <p className="mt-2 text-lg font-black">AIの成長履歴を見る</p>
            <p className="mt-4 text-2xl text-slate-300">→</p>
          </Link>

          <Link
            href="/terms"
            className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition active:scale-[0.99]"
          >
            <p className="text-xs font-black text-blue-600">POLICY</p>
            <p className="mt-2 text-lg font-black">利用規約を確認する</p>
            <p className="mt-4 text-2xl text-slate-300">→</p>
          </Link>
        </section>

        <footer className="py-10 text-center">
          <div className="text-2xl font-black">
            SIGNAL<span className="text-blue-600">X</span>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-400">
            AIが日本株の判断材料を、初心者にも分かりやすく。
          </p>
          <p className="mt-4 text-[11px] text-slate-300">
            © 2026 SIGNALX. All Rights Reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}