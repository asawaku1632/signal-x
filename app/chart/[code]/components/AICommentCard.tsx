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
    return "border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950";
  }

  if (tone === "red") {
    return "border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950";
  }

  if (tone === "blue") {
    return "border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950";
  }

  if (tone === "amber") {
    return "border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950";
  }

  return "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";
}

export default function AICommentCard({ items }: AICommentCardProps) {
  return (
    <section className="rounded-[24px] border border-blue-100 bg-blue-50 p-3.5 shadow-sm dark:border-blue-900 dark:bg-blue-950">
      <h2 className="text-xl font-black text-slate-900 dark:text-white">
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
            <p className="text-sm font-bold leading-6 text-slate-900 dark:text-slate-100">
              <span className="mr-2">{item.icon}</span>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
