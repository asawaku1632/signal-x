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
    label: "検索",
    matchPaths: ["/scan-mobile", "/analysis"],
  },
  {
    href: "/today-market",
    icon: "🤖",
    label: "市場",
    matchPaths: ["/today-market", "/ai-analysis"],
  },
  {
    href: "/ranking",
    icon: "🏆",
    label: "ランキング",
    matchPaths: ["/ranking"],
  },
  {
    href: "/favorites",
    icon: "⭐",
    label: "お気に入り",
    matchPaths: ["/favorites"],
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-md grid-cols-5 px-1 py-2">
        {navItems.map((item) => {
          const active = isActive(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-center text-[11px] font-black transition ${
                active
                  ? "text-yellow-500"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="text-2xl leading-none">{item.icon}</span>

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