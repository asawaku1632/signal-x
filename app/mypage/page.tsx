"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function MyPage() {
  const { data: session, status } = useSession();
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("signalx-favorites");
    const favorites: string[] = saved ? JSON.parse(saved) : [];
    setFavoriteCount(favorites.length);
  }, []);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow">
          <p className="font-bold text-slate-500">ユーザー情報を読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <Link href="/dashboard" className="text-sm font-black text-blue-600">
            ← Dashboardへ戻る
          </Link>

          <section className="mt-4 rounded-[24px] bg-white p-6 text-center shadow">
            <p className="text-5xl">👤</p>
            <h1 className="mt-4 text-2xl font-black">ログインが必要です</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              マイページを表示するにはGoogleログインしてください。
            </p>

            <Link
              href="/login"
              className="mt-6 block rounded-full bg-blue-600 px-6 py-4 text-sm font-black text-white"
            >
              Googleログインへ
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              MY PAGE
            </div>
          </div>

          <div className="h-11 w-11" />
        </header>

        <section className="rounded-[28px] border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 text-center shadow-sm">
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt="user"
              width={88}
              height={88}
              className="mx-auto rounded-full border-4 border-white shadow"
            />
          ) : (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-4xl">
              👤
            </div>
          )}

          <h1 className="mt-4 text-3xl font-black">
            {session.user?.name ?? "ユーザー"}
          </h1>

          <p className="mt-2 text-sm font-bold text-slate-500">
            {session.user?.email}
          </p>

          <div className="mt-5 rounded-2xl bg-white/80 p-4">
            <p className="text-xs font-black text-slate-500">ログイン状態</p>
            <p className="mt-1 text-xl font-black text-green-600">ON</p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/favorites"
            className="rounded-[24px] border border-yellow-200 bg-yellow-50 p-4 text-center shadow-sm"
          >
            <p className="text-3xl">⭐</p>
            <p className="mt-2 text-sm font-black text-slate-500">お気に入り</p>
            <p className="mt-1 text-3xl font-black text-yellow-600">
              {favoriteCount}
            </p>
          </Link>

          <Link
            href="/alerts"
            className="rounded-[24px] border border-orange-200 bg-orange-50 p-4 text-center shadow-sm"
          >
            <p className="text-3xl">🔔</p>
            <p className="mt-2 text-sm font-black text-slate-500">通知設定</p>
            <p className="mt-1 text-3xl font-black text-orange-600">ON</p>
          </Link>

          <Link
            href="/learning"
            className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-center shadow-sm"
          >
            <p className="text-3xl">🧠</p>
            <p className="mt-2 text-sm font-black text-slate-500">AI学習</p>
            <p className="mt-1 text-3xl font-black text-blue-600">確認</p>
          </Link>

          <Link
            href="/result-stats"
            className="rounded-[24px] border border-green-200 bg-green-50 p-4 text-center shadow-sm"
          >
            <p className="text-3xl">📈</p>
            <p className="mt-2 text-sm font-black text-slate-500">AI勝率</p>
            <p className="mt-1 text-3xl font-black text-green-600">確認</p>
          </Link>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">アカウント</h2>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-4 w-full rounded-full bg-slate-900 px-6 py-4 text-sm font-black text-white"
          >
            Googleログアウト
          </button>
        </section>
      </div>
    </main>
  );
}