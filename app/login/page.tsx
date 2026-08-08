import Link from "next/link";

import { isPlayReviewAuthEnabled } from "@/app/lib/playReviewAuth";
import GoogleLoginButton from "./GoogleLoginButton";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-black text-blue-600">
          ← トップへ戻る
        </Link>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-4xl font-black">
            SIGNAL<span className="text-blue-600">X</span>
          </h1>

          <p className="mt-2 text-xs font-black tracking-[0.22em] text-slate-500">
            GOOGLE LOGIN
          </p>

          <h2 className="mt-8 text-2xl font-black">
            Googleアカウントでログイン
          </h2>

          <p className="mt-4 text-sm font-bold leading-7 text-slate-500">
            ログインすると、将来的にお気に入り銘柄や通知設定をアカウントに保存できるようになります。
          </p>

          <GoogleLoginButton />

          {isPlayReviewAuthEnabled() ? (
            <Link
              href="/login/play-review"
              className="mt-8 inline-block text-xs font-bold text-slate-400 underline decoration-slate-300 underline-offset-4 hover:text-slate-600"
            >
              Google Play 審査担当者はこちら
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
