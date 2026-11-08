import Link from "next/link";

/** A textbook illustration. Do not use these made-up points as observed prices. */
export default function DoubleBottomVisualLesson() {
  return (
    <section aria-labelledby="double-bottom-lesson-heading" className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="double-bottom-lesson-heading" className="text-lg font-black text-slate-900">📖 ダブルボトムの見方（目印付き）</h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">学習用の模式図</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        2回の下げ止まりだけでは「今すぐ買い」ではありません。
        間にある戻り高値（ネックライン）を終値で超えられるか、その後の値動きと出来高を見ます。
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] p-2">
        <svg viewBox="0 0 600 292" className="h-auto w-full" role="img"
          aria-label="学習用のダブルボトム図。青丸の底①と底②が2回ある。橙の水平線がネックライン。右端の緑矢印は上抜け後の動きのイメージ。">
          <rect x="0" y="0" width="600" height="292" rx="18" fill="#f8fafc"/>
          {[65,120,175,230].map(y=><line key={y} x1="36" x2="572" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1.5"/>)}
          <path d="M38 68 L82 83 L130 160 L184 233 L228 183 L283 112 L332 160 L381 232 L425 173 L460 116 L488 126 L522 78 L556 47"
            fill="none" stroke="#0f766e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="42" x2="567" y1="113" y2="113" stroke="#d97706" strokeWidth="4" strokeDasharray="10 7"/>
          <rect x="180" y="77" width="240" height="31" rx="15" fill="#fef3c7" stroke="#d97706" strokeWidth="2"/>
          <text x="300" y="99" textAnchor="middle" fontSize="19" fontWeight="bold" fill="#92400e">ネックライン（戻り高値）</text>
          {[{x:184,y:233,label:"底①"},{x:381,y:232,label:"底②"}].map(point=><g key={point.label}>
            <circle cx={point.x} cy={point.y} r="14" fill="#dbeafe" stroke="#2563eb" strokeWidth="5"/>
            <line x1={point.x} x2={point.x} y1={point.y+17} y2="259" stroke="#2563eb" strokeWidth="2"/>
            <rect x={point.x-35} y="258" width="70" height="28" rx="14" fill="#1d4ed8"/>
            <text x={point.x} y="278" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">{point.label}</text>
          </g>)}
          <path d="M505 86 L552 42 M531 42 L553 42 L551 62" fill="none" stroke="#059669" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="472" y="11" width="117" height="27" rx="13" fill="#dcfce7" />
          <text x="530" y="29" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#166534">上抜けの例</text>
          <text x="38" y="27" fontSize="15" fill="#64748b" fontWeight="bold">※ 架空の値動き（実際の銘柄ではありません）</text>
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="rounded-xl bg-blue-50 p-3 font-bold text-blue-900">🔵 底①・底②：安値の候補。ここで買えたという意味ではない。</p>
        <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900">🟠 ネックライン：上抜けを確認したい価格の壁。</p>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <h3 className="font-black text-slate-900">よくある3つの状態</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-rose-200 bg-white p-3">
            <p className="text-sm font-black text-rose-700">① 早すぎる</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">底が2つ見えても、上抜けがまだなら反発は未確認。</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-3">
            <p className="text-sm font-black text-emerald-700">② 上抜けを確認</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">ネックラインを終値で超え、出来高や継続性も確認する。</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-black text-slate-700">③ まだ様子見</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">底を割るなど形が崩れた場合は、買いの根拠を見直す。</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        「上抜けを確認」は勝率や利益の保証ではありません。この図は教材であり、SIGNALXの検出結果・売買サインではありません。
      </p>
      <Link href="/learning/chart-quiz"
        className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white">
        🧠 3択クイズで復習する →
      </Link>
    </section>
  );
}
