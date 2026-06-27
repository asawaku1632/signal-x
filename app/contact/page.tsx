export default function ContactPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold">
        お問い合わせ
      </h1>

      <p className="mb-8 text-gray-600">
        SIGNALXに関するお問い合わせ・ご要望・不具合報告はこちらからお願いいたします。
      </p>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <form className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-bold">
              お名前
            </label>
            <input
              type="text"
              placeholder="山田 太郎"
              className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              メールアドレス
            </label>
            <input
              type="email"
              placeholder="example@example.com"
              className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              お問い合わせ内容
            </label>
            <textarea
              placeholder="お問い合わせ内容をご入力ください"
              rows={8}
              className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            className="w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-200"
          >
            送信する
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-900">
        現在、お問い合わせフォームは準備中です。
        正式対応までは、運営者の案内する連絡先をご利用ください。
      </section>
    </main>
  );
}