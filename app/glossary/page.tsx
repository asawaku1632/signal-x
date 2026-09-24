"use client";

import { useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Term = {
  id: string;
  term: string;
  reading?: string;
  icon: string;
  category: "AIの判定" | "チャート指標" | "投資の基本" | "画面の見方";
  oneLine: string;
  detail: string;
  signalx: string;
  keywords?: string[];
};

const terms: Term[] = [
  { id:"win", term:"WIN", reading:"ウィン", icon:"🟢", category:"AIの判定", oneLine:"AIの予想後、株価が基準以上に上がった結果です。", detail:"SIGNALXが記録した価格と、その後の価格を比べて、決められた上昇基準を超えたときにWINになります。", signalx:"現在の日次判定では、比較した株価が基準から2%以上上がるとWINとして記録します。WINは将来の値上がりを保証する言葉ではありません。" },
  { id:"lose", term:"LOSE", reading:"ルーズ", icon:"🔴", category:"AIの判定", oneLine:"AIの予想後、株価が基準以上に下がった結果です。", detail:"SIGNALXが記録した価格と、その後の価格を比べて、決められた下落基準を超えたときにLOSEになります。", signalx:"現在の日次判定では、比較した株価が基準から2%以上下がるとLOSEとして記録します。" },
  { id:"hold", term:"HOLD", reading:"ホールド", icon:"🟡", category:"AIの判定", oneLine:"大きく上がっても下がってもいない結果です。", detail:"結果を比べたときに、WINにもLOSEにも届かなかった状態です。『失敗』という意味ではありません。", signalx:"現在の日次判定では、値動きがWIN・LOSEの基準内に収まった場合にHOLDになります。HOLDは勝率のWIN・LOSE計算から外して表示します。" },
  { id:"waiting", term:"判定待ち", icon:"⏳", category:"AIの判定", oneLine:"まだ結果を決めるタイミングではない状態です。", detail:"予想や記録はできていますが、比較するための次の株価データなどがまだそろっていません。", signalx:"必要な価格データがそろうと、自動判定の対象になります。休場日は取引がないため営業日とは分けて扱います。" },
  { id:"winrate", term:"勝率", icon:"📊", category:"画面の見方", oneLine:"WINとLOSEのうち、WINだった割合です。", detail:"たとえばWINが6回、LOSEが4回なら勝率は60%です。HOLDや判定待ちは、この勝率の分母には入りません。", signalx:"SIGNALXでは WIN ÷ (WIN + LOSE) × 100 で表示します。件数が少ない勝率は、参考材料のひとつとして見てください。" },
  { id:"provisional", term:"暫定勝率", icon:"🧮", category:"画面の見方", oneLine:"まだ全部の判定が終わっていない途中の勝率です。", detail:"判定待ちが残っているので、あとから数字が変わる可能性があります。", signalx:"未判定データが残っている日にWIN・LOSEが出ている場合、確定値と区別して『暫定』と表示します。" },
  { id:"aiscore", term:"AIスコア", icon:"🧠", category:"AIの判定", oneLine:"AIがいろいろな材料を見てつけた注目度の目安です。", detail:"チャートや複数の指標などをまとめて見やすい数字にしたものです。高い数字だけで売買を決めるものではありません。", signalx:"銘柄を比べたり、AIがどこを注目しているかを見るための補助情報として使います。" },
  { id:"candidate", term:"買い候補", icon:"👀", category:"AIの判定", oneLine:"AIが『ちょっと注目』している銘柄です。", detail:"『必ず買うべき』という命令ではありません。条件を満たした銘柄を見つけやすくするための表示です。", signalx:"最終的な投資判断は利用者自身で行います。候補は調べ始めるきっかけとして使います。" },
  { id:"rsi", term:"RSI", reading:"アールエスアイ", icon:"🌡️", category:"チャート指標", oneLine:"買われすぎ・売られすぎを見るための温度計のような指標です。", detail:"最近の上がり下がりの強さを数字にします。数字が高い・低いだけで、次の値動きが決まるわけではありません。", signalx:"ほかのチャート指標と組み合わせて、今の株価の状態を見る材料にします。" },
  { id:"macd", term:"MACD", reading:"マックディー", icon:"〽️", category:"チャート指標", oneLine:"株価の流れが変わりそうかを見る目安です。", detail:"短い期間と長い期間の値動きの差を使って、勢いの変化を見ます。", signalx:"トレンドやほかの指標と一緒にAI分析の材料として扱います。" },
  { id:"vwap", term:"VWAP", reading:"ブイワップ", icon:"⚖️", category:"チャート指標", oneLine:"その日に、みんながだいたいいくらで取引したかを見る目安です。", detail:"取引された量も考えて計算した平均価格です。現在の株価がその目安より上か下かを見ることがあります。", signalx:"株価の位置やその日の強さを見る材料のひとつとして使います。" },
  { id:"ema20", term:"EMA20", icon:"📈", category:"チャート指標", oneLine:"最近の株価を重めに見た、20期間の平均線です。", detail:"昔の価格より最近の価格を大事にして作る線で、株価の流れを見やすくします。", signalx:"株価がEMA20より上か下かなどを、トレンドを見る材料にします。" },
  { id:"bollinger", term:"ボリンジャーバンド", icon:"🎯", category:"チャート指標", oneLine:"株価がいつもの動きからどれくらい離れているかを見る帯です。", detail:"平均の線の上下に帯を作り、値動きの広がりや位置を見ます。帯に触れただけで上がる・下がると決まるものではありません。", signalx:"チャートパターンや値動きの特徴を理解する補助材料として使います。" },
  { id:"volume", term:"出来高", icon:"🏙️", category:"投資の基本", oneLine:"その株がどれくらいたくさん売買されたかを表す数です。", detail:"出来高が多い日は、多くの人がその株を取引したということです。", signalx:"値動きだけではなく、市場の注目や取引の活発さを見る材料になります。" },
  { id:"uptrend", term:"上昇トレンド", icon:"↗️", category:"投資の基本", oneLine:"株価がだんだん高くなっている流れです。", detail:"細かく上がったり下がったりしながらも、全体として高い方向へ進んでいる状態です。", signalx:"AIがチャートの方向を見るときの基本的な状態のひとつです。" },
  { id:"downtrend", term:"下降トレンド", icon:"↘️", category:"投資の基本", oneLine:"株価がだんだん安くなっている流れです。", detail:"途中で上がる日があっても、全体として安い方向へ進んでいる状態です。", signalx:"上昇トレンドと同じく、チャートの方向を見る基本材料です。" },
  { id:"support", term:"支持線", icon:"🧱", category:"チャート指標", oneLine:"株価が下がったときに、止まりやすいと見られる価格帯です。", detail:"過去に何度か下げ止まった場所などを目安にします。必ずそこで止まるわけではありません。", signalx:"チャートを見るときの価格の目安として使います。" },
  { id:"resistance", term:"抵抗線", icon:"🚧", category:"チャート指標", oneLine:"株価が上がったときに、止まりやすいと見られる価格帯です。", detail:"過去に何度か上昇が止まった場所などを目安にします。必ずそこで下がるわけではありません。", signalx:"上値の目安を考えるための補助情報として使います。" },
  { id:"observing", term:"観察中", icon:"🔎", category:"画面の見方", oneLine:"AIが結果を学ぶために、まだ追いかけているデータです。", detail:"記録したあと、結果を判断するために必要なデータがそろうまで観察しています。", signalx:"観察中の件数は、AI学習のために追跡している記録の状態を表します。" },
];

const categories = ["すべて", "AIの判定", "チャート指標", "投資の基本", "画面の見方"] as const;

export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("すべて");
  const [openId, setOpenId] = useState<string | null>("hold");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((item) => (category === "すべて" || item.category === category) && (!q || [item.term,item.reading,item.oneLine,item.detail,...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase().includes(q)));
  }, [query, category]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-4"><div className="text-5xl">📖</div><div><p className="text-xs font-black tracking-[.18em] text-blue-600">SIGNALX</p><h1 className="mt-1 text-3xl font-black tracking-tight"><span className="text-blue-600">かんたん</span>用語集</h1><p className="mt-2 text-sm font-bold leading-6 text-slate-500">むずかしい投資用語を、小学生でもわかる言葉で説明します。</p></div></div>
          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner"><span>🔍</span><input value={query} onChange={(e)=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="気になる言葉を検索（例：HOLD、RSI、勝率）" /></label>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{categories.map((c)=><button key={c} onClick={()=>setCategory(c)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${category===c?"bg-blue-600 text-white shadow":"border border-slate-200 bg-white text-slate-600"}`}>{c}</button>)}</div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black text-amber-500">★ TAP TO LEARN</p><h2 className="text-xl font-black">{query || category!=="すべて" ? "検索結果" : "よく使う言葉"}</h2></div><span className="text-xs font-bold text-slate-400">{filtered.length}語</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item)=>{
              const open=openId===item.id;
              return <article id={item.id} key={item.id} className="scroll-mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <button onClick={()=>setOpenId(open?null:item.id)} className="flex w-full items-start gap-3 p-4 text-left">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-50 text-2xl">{item.icon}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><h3 className="text-lg font-black">{item.term}</h3>{item.reading&&<span className="text-xs font-bold text-slate-400">{item.reading}</span>}</div><p className="mt-1 text-sm font-bold leading-6 text-slate-600">{item.oneLine}</p><span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600">① ひとことで</span></div><span className="mt-2 text-slate-400">{open?"▲":"▼"}</span>
                </button>
                {open&&<div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black text-amber-700">② もう少しくわしく</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item.detail}</p></div>
                  <div className="mt-3 rounded-2xl bg-blue-50 p-4"><p className="text-xs font-black text-blue-700">③ SIGNALXではどう使う？</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item.signalx}</p></div>
                </div>}
              </article>;
            })}
          </div>
          {filtered.length===0&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="text-4xl">🤔</div><p className="mt-3 font-black">その言葉はまだ見つかりませんでした</p><p className="mt-1 text-sm font-bold text-slate-500">別の言い方でも検索してみてください。</p></div>}
        </section>
        <aside className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5"><p className="font-black text-blue-800">💡 覚えなくても大丈夫</p><p className="mt-2 text-sm font-bold leading-6 text-slate-600">わからない言葉が出たときに、ここへ見に来ればOKです。SIGNALXは、投資をむずかしくするためではなく、わかりやすくするための道具です。</p></aside>
      </div><BottomNav />
    </main>
  );
}
