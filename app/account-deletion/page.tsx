import type { Metadata } from "next";
import Link from "next/link";

const contactEmail = "signalx.support@gmail.com";

export const metadata: Metadata = {
  title: "SIGNALX アカウントとデータの削除",
  description:
    "SIGNALXのアカウント削除依頼の手順、削除されるデータ、保持される場合があるデータと保持期間をご案内します。",
};

const sectionClass = "border-t border-slate-200 pt-8 sm:pt-10";
const headingClass = "text-xl font-bold tracking-tight text-slate-950 sm:text-2xl";
const paragraphClass = "mt-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8";
const listClass =
  "mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:text-blue-500 sm:text-base sm:leading-8";

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 hover:text-blue-900 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ← SIGNALX トップへ
          </Link>
          <p className="mt-8 text-xs font-bold tracking-[0.2em] text-blue-700">
            ACCOUNT DELETION
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            SIGNALX アカウントとデータの削除
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            このページでは、SIGNALXのアカウント削除依頼の方法と、削除・保持されるデータについてご案内します。ログインせずに削除を依頼できます。
          </p>
        </div>
      </header>

      <article className="mx-auto max-w-4xl space-y-9 px-5 py-10 sm:space-y-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
          <h2 className={headingClass}>削除依頼の手順</h2>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-7 text-slate-700 marker:font-bold marker:text-blue-700 sm:text-base sm:leading-8">
            <li>
              SIGNALXの
              <Link href="/contact" className="font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900">
                お問い合わせページ
              </Link>
              を開きます。
            </li>
            <li>
              掲載されているメールアドレス宛てに、件名を「SIGNALXアカウント削除依頼」として送信してください。
            </li>
            <li>
              削除対象アカウントの確認のため、Googleログインに使用したメールアドレス等を確認する場合があります。
            </li>
            <li>本人確認後、アカウントに紐づく削除対象データを削除します。</li>
          </ol>
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent("SIGNALXアカウント削除依頼")}`}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
          >
            アカウント削除をメールで依頼する
          </a>
          <p className="mt-3 break-all text-sm font-bold text-blue-800">{contactEmail}</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>削除されるデータ</h2>
          <p className={paragraphClass}>
            本人確認後、SIGNALXのサーバーに保存されている次のデータを削除します。
          </p>
          <ul className={listClass}>
            <li>Googleログインに使用したメールアドレス</li>
            <li>お気に入り銘柄コード</li>
            <li>お気に入り銘柄名</li>
            <li>お気に入りへの登録日時</li>
          </ul>
          <p className={paragraphClass}>
            削除依頼の受付と本人確認が完了した後、原則として30日以内に削除します。
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>保持される場合があるデータと保持期間</h2>
          <p className={paragraphClass}>
            法令対応、不正利用防止、セキュリティ、障害調査などのために必要なアクセス・処理・障害等のログは、アカウントに紐づくデータの削除後も保持される場合があります。
          </p>
          <p className={paragraphClass}>
            これらのログに一律の固定保持日数は設けていません。各サービス提供者の保存設定・規約に定められた期間、または法令上必要な期間に従って保持し、その必要がなくなった後に削除されます。
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>端末に保存されるデータ</h2>
          <p className={paragraphClass}>
            通知の既読状態などは、SIGNALXのサーバーではなく、ご利用の端末のブラウザにあるローカルストレージへ保存されます。これらはブラウザのサイトデータ削除機能等から削除できます。
          </p>
          <p className={paragraphClass}>
            アプリをアンインストールしただけでは、サーバーに保存されたメールアドレスやお気に入り銘柄のデータが自動的に削除されない場合があります。サーバー側のデータも削除するには、上記の手順で削除を依頼してください。
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>お問い合わせ</h2>
          <p className={paragraphClass}>
            アカウント削除について不明な点がある場合も、SIGNALXのお問い合わせページからご連絡ください。
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-600 px-5 text-sm font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
          >
            お問い合わせページへ
          </Link>
        </section>

        <p className="border-t border-slate-200 pt-6 text-sm leading-7 text-slate-500">
          関連情報：
          <Link href="/privacy" className="font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900">
            SIGNALX プライバシーポリシー
          </Link>
        </p>
      </article>
    </main>
  );
}
