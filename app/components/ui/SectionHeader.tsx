type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  emoji?: string;
};

export default function SectionHeader({ title, subtitle, emoji }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {emoji && <span className="text-xl">{emoji}</span>}
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
      </div>
      {subtitle && (
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}