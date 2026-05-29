type Props = {
  item: any;
  index: number;
  setSelectedStock: (stock: any) => void;
};

export default function SignalCard({
  item,
  index,
  setSelectedStock,
}: Props) {
  const getCardStyle = (stage: string) => {
    if (
      stage.includes("上がり") ||
      stage.includes("強い") ||
      stage.includes("買い")
    ) {
      return {
        border: "border-green-500/40",
        bg: "bg-green-500/10",
        text: "text-green-300",
      };
    }

    if (
      stage.includes("危険") ||
      stage.includes("売り") ||
      stage.includes("注意")
    ) {
      return {
        border: "border-red-500/40",
        bg: "bg-red-500/10",
        text: "text-red-300",
      };
    }

    return {
      border: "border-yellow-500/40",
      bg: "bg-yellow-500/10",
      text: "text-yellow-300",
    };
  };

  const style = getCardStyle(item.stage);

  return (
    <div
      onClick={() => setSelectedStock(item)}
      className={`cursor-pointer rounded-3xl border ${style.border} ${style.bg} p-2 transition active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] text-zinc-500">
            #{index + 1}
          </p>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black">
              {item.code}
            </h2>

            <p className="text-xs text-zinc-300">
              {item.name}
            </p>

            <p
              className={`text-sm font-black ${style.text}`}
            >
              {item.stage}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9px] text-zinc-500">
            AI期待値
          </p>

          <p
            className={`text-3xl font-black ${style.text}`}
          >
            {item.expectation}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-black/30 p-2">
          <p className="text-[9px] text-zinc-500">
            勝率
          </p>

          <p className="text-sm font-black text-green-300">
            {item.winRate}%
          </p>
        </div>

        <div className="rounded-xl bg-black/30 p-2">
          <p className="text-[9px] text-zinc-500">
            リスク
          </p>

          <p className="text-sm font-black text-yellow-300">
            {item.risk}
          </p>
        </div>

        <div className="rounded-xl bg-black/30 p-2">
          <p className="text-[9px] text-zinc-500">
            価格
          </p>

          <p className="text-sm font-black text-cyan-300">
            {item.price}
          </p>
        </div>
      </div>
    </div>
  );
}