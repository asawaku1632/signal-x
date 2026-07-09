type SignalCardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function SignalCard({ children, className = "" }: SignalCardProps) {
  return (
    <div
      className={[
        "rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]",
        "backdrop-blur-xl transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.12)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}