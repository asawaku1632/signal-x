export default function PerformanceMetricClarifier() {
  return (
    <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
      <p className="text-sm font-black text-blue-700">「累計損益」について</p>
      <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
        この既存値は実際の口座利益ではありません。各AI判定について、保存時価格から翌営業日価格までの値動きを100株換算し、その結果を合算したAI学習用の検証値です。
      </p>
    </div>
  );
}
