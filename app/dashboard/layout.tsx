import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <div className="bg-[#f7f9fc] px-3 pb-24">
        <div className="mx-auto max-w-md">
          <Link
            href="/glossary"
            className="flex min-h-[66px] items-center gap-3 rounded-xl border border-blue-200 bg-white px-3 py-2.5 shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-2xl">
              📘
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black leading-tight text-slate-900">
                かんたん用語集
              </h2>
              <p className="mt-1 text-xs font-bold leading-4 text-slate-500">
                HOLD・AIスコア・投資用語をやさしく解説
              </p>
            </div>
            <span className="text-2xl text-slate-400" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
