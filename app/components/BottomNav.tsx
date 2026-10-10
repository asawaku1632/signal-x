"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  matchPaths?: string[];
};

const publicNavItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: "🏠",
    label: "ホーム",
    matchPaths: ["/dashboard"],
  },
  {
    href: "/scan-mobile",
    icon: "🔍",
    label: "スキャン",
    matchPaths: ["/scan-mobile", "/scan"],
  },
  {
    href: "/today-market",
    icon: "🤖",
    label: "市場",
    matchPaths: [
      "/today-market",
      "/ranking",
      "/favorites",
      "/favorites-alerts",
      "/alerts",
      "/history",
      "/top-signals",
      "/performance",
      "/result-stats",
      "/result-ranking",
      "/results",
      "/simulation",
      "/chart",
    ],
  },
  {
    href: "/ai-analysis",
    icon: "🧠",
    label: "AI分析",
    matchPaths: ["/ai-analysis", "/analysis"],
  },
  {
    href: "/learning/patterns",
    icon: "📚",
    label: "図鑑",
    matchPaths: ["/learning"],
  },
  {
    href: "/menu",
    icon: "☰",
    label: "メニュー",
    matchPaths: ["/menu"],
  },
];


const privateLearningNav: NavItem = {
  href: "/admin/learning-hub",
  icon: "🧪",
  label: "学習管理",
  matchPaths: ["/admin", "/simulation/conflict-check"],
};

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [verifiedOwnerEmail, setVerifiedOwnerEmail] = useState<string | null>(null);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  const owner = status === "authenticated" && email !== null && verifiedOwnerEmail === email;

  useEffect(() => {
    // Owner visibility is tied to the authenticated email and fails closed.
    if (status !== "authenticated" || !email) return;
    const controller = new AbortController();
    void fetch("/api/private-learning-access", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return false;
      const data: { isOwner?: boolean } = await response.json();
      return data.isOwner === true;
    }).then((allowed) => {
      if (!controller.signal.aborted) setVerifiedOwnerEmail(allowed ? email : null);
    }).catch(() => {
      if (!controller.signal.aborted) setVerifiedOwnerEmail(null);
    });
    return () => controller.abort();
  }, [status, email]);

  const navItems = owner
    ? [...publicNavItems.slice(0, 5), privateLearningNav, ...publicNavItems.slice(5)]
    : publicNavItems;


  const isActive = (item: NavItem) => {
    const paths = item.matchPaths ?? [item.href];

    return paths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
      <div className={`mx-auto grid h-16 max-w-lg ${owner ? "grid-cols-7" : "grid-cols-6"} px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2`}>
        {navItems.map((item) => {
          const active = isActive(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-center text-[10px] font-black transition-colors ${
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>

              <span className="w-full truncate leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
