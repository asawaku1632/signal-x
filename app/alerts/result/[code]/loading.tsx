export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="mt-4 font-black">通知結果を確認しています</p>
      </div>
    </main>
  );
}
