import type { Metadata } from "next";
import Link from "next/link";

const contactEmail = "signalx.support@gmail.com";

export const metadata: Metadata = {
  title: "お問い合わせ | SIGNALX",
  description:
    "SIGNALXへのお問い合わせ、アカウント削除依頼、不具合報告の窓口をご案内します。",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 hover:text-blue-900 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ← SIGNALX トップへ
          </Link>
          <p className="mt-8 text-xs font-bold tracking-[0.2em] text-blue-700">
            CONTACT
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            お問い合わせ
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            SIGNALXに関するお問い合わせ、ご要望、不具合報告、アカウント削除依頼をメールで受け付けています。
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            メールで問い合わせる
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
            次のメールアドレスへご連絡ください。メールアプリが開かない場合は、アドレスをコピーしてご利用ください。
          </p>
          <p className="mt-4 break-all text-base font-bold text-blue-700 sm:text-lg">
            {contactEmail}
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
          >
            メールを作成する
          </a>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-950">
            アカウント削除をご希望の方
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
            件名に「SIGNALXアカウント削除依頼」と記載してください。詳しい手順と削除対象データは、アカウント削除ページをご確認ください。
          </p>
          <Link
            href="/account-deletion"
            className="mt-4 inline-flex min-h-11 items-center font-bold text-blue-700 underline decoration-2 underline-offset-4 hover:text-blue-900 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            アカウント削除ページを見る
          </Link>
        </section>
      </div>
    </main>
  );
}
