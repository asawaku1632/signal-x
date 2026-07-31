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
        <h2
          id={`menu-${tone}`}
          className={`shrink-0 text-sm font-black tracking-wide sm:text-base ${sectionStyles[tone]}`}
        >
          {title}
        </h2>
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-4">
        {items.map((item) => (
          <Link
            key={`${item.title}-${item.href}`}
            href={item.href}
            className="group flex min-h-32 min-w-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-5 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] sm:min-h-36 sm:px-5"
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl text-3xl transition duration-200 group-hover:scale-105 sm:h-14 sm:w-14 sm:text-4xl ${item.accent}`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="mt-3 break-words text-sm font-black leading-5 text-slate-900 sm:text-base">
              {item.title}
            </span>
            <span className="mt-1 hidden text-xs font-bold leading-5 text-slate-500 min-[380px]:block">
              {item.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
