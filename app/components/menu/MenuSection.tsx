import Link from "next/link";

export type MenuItem = {
  title: string;
  description: string;
  href: string;
  icon: string;
  accent: string;
};

type MenuSectionProps = {
  title: string;
  tone: "violet" | "emerald" | "blue";
  items: MenuItem[];
};

const sectionStyles = {
  violet: "text-violet-600 before:bg-violet-200",
  emerald: "text-emerald-600 before:bg-emerald-200",
  blue: "text-blue-600 before:bg-blue-200",
} as const;

export default function MenuSection({ title, tone, items }: MenuSectionProps) {
  return (
    <section aria-labelledby={`menu-${tone}`}>
      <div className="flex items-center gap-3">
        <h2 id={`menu-${tone}`} className={`shrink-0 text-sm font-black tracking-wide sm:text-base ${sectionStyles[tone]}`}>
          {title}
        </h2>
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-3 sm:grid-cols-3 sm:gap-3">
        {items.map((item) => (
          <Link
            key={`${item.title}-${item.href}`}
            href={item.href}
            className="group flex min-h-24 min-w-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-2.5 py-3 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] sm:min-h-28 sm:px-4 sm:py-4"
          >
            <span className={`grid h-10 w-10 place-items-center rounded-xl text-2xl transition duration-200 group-hover:scale-105 sm:h-11 sm:w-11 sm:text-3xl ${item.accent}`} aria-hidden="true">
              {item.icon}
            </span>
            <span className="mt-2 break-words text-[13px] font-black leading-4 text-slate-900 sm:text-sm">
              {item.title}
            </span>
            <span className="mt-0.5 hidden text-[10px] font-bold leading-4 text-slate-500 min-[380px]:block sm:text-[11px]">
              {item.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
