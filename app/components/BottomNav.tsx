"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  matchPaths?: string[];
};

const navItems: NavItem[] = [
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

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    const paths = item.matchPaths ?? [item.href];

    return paths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-6 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
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
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
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
