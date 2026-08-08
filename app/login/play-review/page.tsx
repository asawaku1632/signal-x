import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isPlayReviewAuthEnabled } from "@/app/lib/playReviewAuth";
import ReviewLoginForm from "./ReviewLoginForm";

export const metadata: Metadata = {
  title: "Google Play Review Login | SIGNALX",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function PlayReviewLoginPage() {
  if (!isPlayReviewAuthEnabled()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="text-sm font-black text-blue-600">
          ← ログインへ戻る
        </Link>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="text-center">
            <p className="text-xs font-black tracking-[0.2em] text-blue-600">
              GOOGLE PLAY REVIEW
            </p>
            <h1 className="mt-3 text-2xl font-black">審査担当者ログイン</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              Google Play審査用に提供された認証情報を入力してください。
            </p>
          </div>

          <ReviewLoginForm />
        </section>
      </div>
    </main>
  );
}
