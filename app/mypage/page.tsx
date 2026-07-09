"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type SettingLink = {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
};

export default function MyPage() {
  const { data: session, status } = useSession();
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("signalx-favorites");
      const favorites: string[] = saved ? JSON.parse(saved) : [];
      setFavoriteCount(Array.isArray(favorites) ? favorites.length : 0);
    } catch {
      setFavoriteCount(0);
    }
  }, []);

  const accountName = session?.user?.name ?? "ユーザー";
  const accountEmail = session?.user?.email ?? "メールアドレス未取得";
  const accountImage = session?.user?.image;

  const menuItems = useMemo<SettingLink[]>(
    () => [
      {
        href: "/favorites",
        icon: "⭐",
        title: "お気に入り銘柄",
        description: "保存した監視銘柄を確認します。",
        badge: `${favoriteCount}件`,
      },
      {
        href: "/alerts",
        icon: "🔔",
        title: "通知・アラート",
        description: "AI通知やLINE通知の状態を確認します。",
        badge: "ON",
      },
      {
        href: "/learning",
        icon: "🧠",
        title: "AI学習状況",
        description: "SIGNALXが蓄積している学習データを確認します。",
      },
      {
        href: "/result-stats",
        icon: "📈",
        title: "AI勝率データ",
        description: "銘柄別の判定結果と勝率を確認します。",
      },
      {
        href: "/today-market",
        icon: "🌤️",
        title: "今日の市場総評",
        description: "相場全体の強弱とAIの見立てを確認します。",
      },
      {
        href: "/top-signals",
        icon: "🔥",
        title: "大本命シグナル",
        description: "AI POWER上位の注目候補を確認します。",
      },
    ],
    [favoriteCount]
  );

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black tracking-[0.18em] text-blue-600">
            SIGNALX
          </p>
          <p className="mt-3 text-lg font-black text-slate-600">
            ユーザー情報を読み込み中...
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <Link href="/" className="text-sm font-black text-blue-600">
            ← Homeへ戻る
          </Link>

          <section className="mt-4 rounded-[32px] border border-slate-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-blue-50 text-4xl">
              👤
            </div>
            <h1 className="mt-5 text-2xl font-black">ログインが必要です</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              マイページ・通知設定・お気に入り銘柄を使うには、Googleログインしてください。
            </p>

            <Link
              href="/login"
              className="mt-6 block rounded-full bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-sm shadow-blue-200"
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
            <div className="mt-1 text-xs font-black tracking-[0.22em] text-slate-500">
              MY PAGE
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

        <section className="overflow-hidden rounded-[34px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            {accountImage ? (
              // Googleアカウント画像は外部URLのため、ここでは通常のimgを使用します。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={accountImage}
                alt="user"
                className="h-[76px] w-[76px] rounded-[26px] border-4 border-white object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border-4 border-white bg-slate-100 text-4xl shadow-sm">
                👤
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                GOOGLE ACCOUNT
              </p>
              <h1 className="mt-1 truncate text-2xl font-black">
                {accountName}
              </h1>
              <p className="mt-1 truncate text-xs font-bold text-slate-500">
                {accountEmail}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[22px] bg-white/80 p-3 text-center shadow-sm">
              <p className="text-xs font-black text-slate-500">ログイン</p>
              <p className="mt-1 text-lg font-black text-green-600">ON</p>
            </div>
            <div className="rounded-[22px] bg-white/80 p-3 text-center shadow-sm">
              <p className="text-xs font-black text-slate-500">お気に入り</p>
              <p className="mt-1 text-lg font-black text-yellow-600">
                {favoriteCount}
              </p>
            </div>
            <div className="rounded-[22px] bg-white/80 p-3 text-center shadow-sm">
              <p className="text-xs font-black text-slate-500">通知</p>
              <p className="mt-1 text-lg font-black text-orange-600">ON</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                SETTINGS HUB
              </p>
              <h2 className="mt-1 text-2xl font-black">設定と確認</h2>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
              V2 UI
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-[24px] border border-slate-100 bg-[#f8fafc] p-4 transition active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-2xl shadow-sm">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-900">
                      {item.title}
                    </p>
                    {item.badge ? (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">
                    {item.description}
                  </p>
                </div>
                <div className="text-xl font-black text-slate-300">›</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-slate-400">
            APP INFO
          </p>
          <h2 className="mt-1 text-xl font-black">SIGNALXについて</h2>

          <div className="mt-4 space-y-3">
            <Link
              href="/terms"
              className="flex items-center justify-between rounded-[22px] bg-slate-50 p-4 text-sm font-black"
            >
              <span>📄 利用規約</span>
              <span className="text-slate-300">›</span>
            </Link>
            <Link
              href="/privacy"
              className="flex items-center justify-between rounded-[22px] bg-slate-50 p-4 text-sm font-black"
            >
              <span>🔒 プライバシーポリシー</span>
              <span className="text-slate-300">›</span>
            </Link>
            <Link
              href="/contact"
              className="flex items-center justify-between rounded-[22px] bg-slate-50 p-4 text-sm font-black"
            >
              <span>💬 お問い合わせ</span>
              <span className="text-slate-300">›</span>
            </Link>
          </div>

          <div className="mt-4 rounded-[24px] bg-blue-50 p-4">
            <p className="text-xs font-black text-blue-600">DEVELOPER MESSAGE</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              SIGNALXは、初心者でも相場の強弱を直感的に判断できるように作られたAI株式監視ツールです。
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">アカウント操作</h2>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
            ログアウトすると、再度Googleログインが必要になります。
          </p>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-4 w-full rounded-full bg-slate-900 px-6 py-4 text-sm font-black text-white shadow-sm"
          >
            Googleログアウト
          </button>
        </section>
      </div>
    </main>
  );
}
