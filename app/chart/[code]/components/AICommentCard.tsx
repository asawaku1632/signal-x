"use client";

type CommentTone = "green" | "red" | "blue" | "amber" | "slate";

type CommentItem = {
  icon: string;
  text: string;
  tone: CommentTone;
};

type AICommentCardProps = {
  items: CommentItem[];
};

function getToneClass(tone: CommentTone) {
  if (tone === "green") {
    return "border-emerald-100 bg-emerald-50";
  }

  if (tone === "red") {
    return "border-red-100 bg-red-50";
  }

  if (tone === "blue") {
    return "border-blue-100 bg-blue-50";
  }

  if (tone === "amber") {
    return "border-amber-100 bg-amber-50";
  }

  return "border-slate-200 bg-white";
}

export default function AICommentCard({ items }: AICommentCardProps) {
  return (
    <section className="rounded-[24px] border border-blue-100 bg-blue-50 p-4 shadow-sm">
      <p className="text-xs font-black tracking-[0.16em] text-blue-700">
        AI COMMENT
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-900">
        チャートAIコメント
      </h2>

      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item.icon}-${index}`}
            className={`rounded-[16px] border px-3 py-2.5 ${getToneClass(
              item.tone,
            )}`}
          >
            <p className="text-sm font-bold leading-6 text-slate-900">
              <span className="mr-2">{item.icon}</span>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
