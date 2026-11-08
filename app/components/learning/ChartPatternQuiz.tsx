"use client";

import Link from "next/link";
import { useState } from "react";

type Choice = {
  label: string;
  hint: string;
  points: string;
};
type Question = {
  theme: string;
  prompt: string;
  options: [Choice, Choice, Choice];
  answer: number;
  reason: string;
  takeaway: string;
};

const questions: Question[] = [
  {
    theme: "ダブルボトム反発",
    prompt: "次の3つで、上昇を確認する材料が一番そろっているのは？",
    options: [
      { label: "① 底を2回つけただけ", hint: "まだ高値を超えていない", points: "6,18 24,54 43,30 62,54 77,36 92,28" },
      { label: "② 戻り高値を終値で上抜け", hint: "出来高も確認したい", points: "6,19 22,54 41,28 59,53 76,30 90,14" },
      { label: "③ 2回目の底をさらに割る", hint: "形が崩れている可能性", points: "6,17 23,49 41,28 59,51 76,60 91,63" },
    ],
    answer: 1,
    reason: "②は2回の底に加えて、戻り高値（ネックライン）を超えた形です。ただし出来高・継続性・相場環境の確認も必要で、最も勝てると証明されたわけではありません。",
    takeaway: "底が2つあることと、反発の確認ができたことは別。",
  },
  {
    theme: "9:05以降の判断",
    prompt: "寄り付き直後の急騰に飛びつかないためには、どの情報を見る？",
    options: [
      { label: "① 9:00直後に上がった事実だけ", hint: "勢いが続くかは未確認", points: "6,52 24,13 42,27 58,38 76,53 92,55" },
      { label: "② 昨日の終値だけ", hint: "今日の値動きは分からない", points: "6,38 24,38 43,39 61,38 77,39 92,38" },
      { label: "③ 9:00足の完成と取得時刻", hint: "その時点で利用可能な値を確認", points: "6,49 24,45 42,42 59,37 76,27 92,18" },
    ],
    answer: 2,
    reason: "③。9:05には9:00～9:05の足が完成する時刻ですが、配信元の遅延があり得ます。9:05時点で本当に受信できたデータか確認し、9:05足の未完成の高値・安値・終値を使ってはいけません。",
    takeaway: "後から届いたデータを、朝9:05に見えていたことにはしない。",
  },
  {
    theme: "リスクと見送り",
    prompt: "買い候補でも形が崩れそうなとき、どの考え方が適切？",
    options: [
      { label: "① 見送り、許容損失と撤退条件を確認", hint: "買わない判断も選択肢", points: "6,14 24,23 42,28 59,40 76,50 92,58" },
      { label: "② AI POWERが高ければ必ず買う", hint: "スコアだけでは保証されない", points: "6,51 24,41 42,15 59,40 76,22 92,52" },
      { label: "③ 下がるほど無条件に買い増す", hint: "損失が膨らむ可能性", points: "6,16 24,29 42,41 59,50 76,56 92,62" },
    ],
    answer: 0,
    reason: "①。銘柄が買い候補でも、実際に買う時刻・価格・損失上限の条件が整わなければ見送れます。AIスコアは購入指示ではありません。",
    takeaway: "監視候補と今すぐ買える条件を混ぜない。",
  },
];

function MiniChart({ points, label }: { points: string; label: string }) {
  return (
    <svg viewBox="0 0 100 70" className="h-20 w-full rounded-lg bg-slate-50" role="img" aria-label={label + "の教材用チャート"}>
      {[16,36,56].map(y=><line key={y} x1="3" x2="97" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
      <line x1="4" x2="96" y1="29" y2="29" stroke="#d97706" strokeWidth="1.4" strokeDasharray="4 3"/>
      <polyline points={points} fill="none" stroke="#059669" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChartPatternQuiz() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = questions[step];
  const answered = selected !== null;

  function next() {
    if (selected === null) return;
    const nextCorrect = correct + (selected === question.answer ? 1 : 0);
    setCorrect(nextCorrect);
    if (step === questions.length - 1) setFinished(true);
    else {
      setStep(step + 1);
      setSelected(null);
    }
  }

  function restart() {
    setStep(0);
    setSelected(null);
    setCorrect(0);
    setFinished(false);
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6" aria-label="チャート見方クイズ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-slate-900">🧠 チャート見方クイズ</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">初級・学習用</span>
      </div>
      <p className="mt-2 text-xs font-bold text-slate-500">
        この練習には架空のチャートを使います。正解は「必ず勝てる売買」を意味しません。
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" aria-label="回答進捗">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(finished ? questions.length : step + (answered ? 1 : 0)) / questions.length * 100}%` }} />
      </div>
      {finished ? (
        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-center" aria-live="polite">
          <p className="text-sm font-black text-blue-700">3問の練習が終了</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{correct} / {questions.length} 問正解</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">買う前に、形の完成・その時点の情報・損失条件を確認する習慣をつけよう。</p>
          <button type="button" onClick={restart} className="mt-4 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white">もう一度挑戦</button>
        </div>
      ) : (
        <>
          <p className="mt-5 text-xs font-black text-blue-700">{question.theme} ・ {step + 1} / {questions.length}問</p>
          <h3 className="mt-2 text-base font-black leading-7 text-slate-900">{question.prompt}</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {question.options.map((option, i) => {
              const chosen = selected === i;
              const correctAnswer = answered && i === question.answer;
              const wrongAnswer = answered && chosen && !correctAnswer;
              return (
                <button key={i} type="button" disabled={answered} aria-pressed={chosen} onClick={() => setSelected(i)}
                  className={`min-w-0 rounded-2xl border-2 p-3 text-left transition focus-visible:outline-2 focus-visible:outline-blue-600 ${correctAnswer ? "border-emerald-500 bg-emerald-50" : wrongAnswer ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-blue-400"}`}>
                  <MiniChart points={option.points} label={option.label}/>
                  <p className="mt-2 text-sm font-black leading-6 text-slate-900">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{option.hint}</p>
                </button>
              );
            })}
          </div>
          {answered ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4" role="status" aria-live="polite">
              <p className="text-base font-black text-slate-900">{selected === question.answer ? "✅ 正解！" : `正解は ${question.answer + 1}番`}</p>
              <p className="mt-2 text-sm leading-6 text-slate-800">{question.reason}</p>
              <p className="mt-2 text-sm font-black text-blue-800">覚えること：{question.takeaway}</p>
              <button type="button" onClick={next} className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-black text-white">
                {step + 1 < questions.length ? "次の問題へ →" : "結果を見る"}
              </button>
            </div>
          ) : <p className="mt-3 text-xs text-slate-600">選択肢をタップすると正解と理由が表示されます。</p>}
        </>
      )}
      <Link href="/learning/patterns/pattern002" className="mt-5 block text-center text-sm font-black text-blue-700 underline underline-offset-4">
        📚 ダブルボトムの図鑑で復習する
      </Link>
    </section>
  );
}
