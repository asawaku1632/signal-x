import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SIGNALX プライバシーポリシー",
  description:
    "日本株のAI分析サービス「SIGNALX」における、利用者情報の取扱いについてご案内します。",
};

const sections = [
  { id: "service", label: "1. SIGNALXが提供するサービス" },
  { id: "information", label: "2. 取得する可能性のある情報" },
  { id: "purpose", label: "3. 情報の利用目的" },
  { id: "third-party", label: "4. 第三者提供" },
  { id: "external-services", label: "5. 外部サービスの利用" },
  { id: "cookies", label: "6. Cookie等の利用" },
  { id: "management", label: "7. 保存・管理" },
  { id: "deletion", label: "8. 削除依頼" },
  { id: "minors", label: "9. 未成年者の利用" },
  { id: "changes", label: "10. 本ポリシーの変更" },
  { id: "contact", label: "11. お問い合わせ" },
] as const;

const sectionClass =
  "scroll-mt-6 border-t border-slate-200 pt-8 sm:pt-10";
const headingClass =
  "text-xl font-bold tracking-tight text-slate-950 sm:text-2xl";
const paragraphClass = "mt-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8";
const listClass =
  "mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:text-blue-500 sm:text-base sm:leading-8";

export default function PrivacyPage() {
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
            PRIVACY POLICY
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            SIGNALX プライバシーポリシー
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            SIGNALX（以下「本サービス」といいます。）は、利用者に関する情報を適切に取り扱うため、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
            <div className="flex gap-2">
              <dt className="font-bold text-slate-800">制定日</dt>
              <dd>2026年8月8日</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-slate-800">最終更新日</dt>
              <dd>2026年8月8日</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="プライバシーポリシー目次" className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-sm font-bold text-slate-950">目次</p>
          <ol className="mt-3 grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 leading-5 hover:bg-white hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 space-y-9 sm:space-y-10">
          <section id="service" className="scroll-mt-6">
            <h2 className={headingClass}>1. SIGNALXが提供するサービス</h2>
            <p className={paragraphClass}>
              本サービスは、日本株に関する株価・チャート等の情報をもとに、AIによる分析結果、注目銘柄、ランキングその他の参考情報を提供する情報サービスです。
            </p>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950 sm:p-5 sm:text-base sm:leading-8">
              本サービスは証券会社ではなく、株式の売買注文の受託・執行、資金や有価証券の預かり、その他の証券取引そのものを行うものではありません。掲載情報は投資成果を保証するものではなく、最終的な投資判断は利用者ご自身の判断と責任で行ってください。
            </div>
          </section>

          <section id="information" className={sectionClass}>
            <h2 className={headingClass}>2. 取得する可能性のある情報</h2>
            <p className={paragraphClass}>
              本サービスは、利用する機能や閲覧環境に応じて、次の情報を取得または取り扱う場合があります。
            </p>
            <ul className={listClass}>
              <li>
                <span className="font-bold text-slate-900">アカウント情報：</span>
                Googleログインを利用した場合にGoogleから提供される氏名、メールアドレス、プロフィール画像等
              </li>
              <li>
                <span className="font-bold text-slate-900">メールアドレス：</span>
                本人識別、ログイン状態の管理、お気に入り銘柄の保存等に使用する情報
              </li>
              <li>
                <span className="font-bold text-slate-900">利用状況：</span>
                お気に入り銘柄、通知の既読状態、閲覧・操作状況、アクセス日時、エラーや処理の記録等
              </li>
              <li>
                <span className="font-bold text-slate-900">技術情報：</span>
                IPアドレス、Cookie・セッション情報、端末・OS・ブラウザの種類、ユーザーエージェント等、アクセスやセキュリティ管理に伴い送信される情報
              </li>
            </ul>
            <p className={paragraphClass}>
              なお、証券口座情報、売買注文情報、入出金情報を本サービスが取得・保管することは想定していません。
            </p>
          </section>

          <section id="purpose" className={sectionClass}>
            <h2 className={headingClass}>3. 情報の利用目的</h2>
            <ul className={listClass}>
              <li>Googleログインの提供、ログイン状態の維持および本人識別のため</li>
              <li>お気に入り銘柄、通知その他の本サービス機能を提供するため</li>
              <li>お問い合わせへの対応、障害・不具合の調査および復旧のため</li>
              <li>利用状況を把握し、利便性・品質・表示内容を改善するため</li>
              <li>不正利用の防止、アクセス制御その他のセキュリティ維持のため</li>
              <li>法令上必要な対応を行うため</li>
            </ul>
          </section>

          <section id="third-party" className={sectionClass}>
            <h2 className={headingClass}>4. 第三者提供</h2>
            <p className={paragraphClass}>
              本サービスは、法令に基づく場合、人の生命・身体・財産の保護に必要で本人の同意を得ることが難しい場合、または本ポリシーに記載する外部サービスの利用に必要な場合等を除き、利用者に関する情報を本人の同意なく第三者へ提供しません。
            </p>
            <p className={paragraphClass}>
              サービス運営に必要な範囲で取扱いを外部事業者に委託する場合は、提供先の選定や契約等を通じて、可能な範囲で適切な管理に努めます。
            </p>
          </section>

          <section id="external-services" className={sectionClass}>
            <h2 className={headingClass}>5. 外部サービスの利用</h2>
            <p className={paragraphClass}>
              本サービスでは、提供・運用に必要な範囲で次の外部サービスを利用しています。各事業者における情報の取扱いには、当該事業者の規約やプライバシーポリシーが適用される場合があります。
            </p>
            <dl className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 px-4 sm:px-5">
              <div className="py-4">
                <dt className="font-bold text-slate-950">Google認証</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-700">Googleアカウントによるログインと本人識別</dd>
              </div>
              <div className="py-4">
                <dt className="font-bold text-slate-950">Supabase</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-700">メールアドレスにひもづくお気に入り銘柄等、サービスデータのデータベース保存</dd>
              </div>
              <div className="py-4">
                <dt className="font-bold text-slate-950">Vercel</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-700">本サービスの配信、サーバー処理、アクセス・障害に関するログの管理</dd>
              </div>
              <div className="py-4">
                <dt className="font-bold text-slate-950">Yahoo Finance関連サービス</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-700">株価・市場情報の取得。利用者の証券口座との連携には使用しません</dd>
              </div>
              <div className="py-4">
                <dt className="font-bold text-slate-950">LINE Messaging API</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-700">運営上の株価情報・処理結果等の通知</dd>
              </div>
            </dl>
          </section>

          <section id="cookies" className={sectionClass}>
            <h2 className={headingClass}>6. Cookie等の利用</h2>
            <p className={paragraphClass}>
              本サービスは、Googleログイン後のセッション維持やセキュリティ確保のためCookieを利用します。また、ブラウザのローカルストレージを利用して、お気に入り銘柄や通知の既読状態等を端末内に保存する場合があります。Cookieはブラウザの設定で無効化できますが、ログインを含む一部機能が利用できなくなることがあります。
            </p>
          </section>

          <section id="management" className={sectionClass}>
            <h2 className={headingClass}>7. 個人情報の保存・管理</h2>
            <p className={paragraphClass}>
              本サービスは、利用目的の達成に必要と考えられる範囲・期間で情報を保存し、不正アクセス、漏えい、紛失、改ざん等のリスクを低減するため、アクセス制御その他の合理的な安全管理措置を講じるよう努めます。保存期間は、情報の性質、利用目的、法令上の要請、運用上の必要性等を考慮して判断します。
            </p>
          </section>

          <section id="deletion" className={sectionClass}>
            <h2 className={headingClass}>8. ユーザーによる削除依頼</h2>
            <p className={paragraphClass}>
              利用者は、ご自身に関する情報の確認、訂正または削除を希望する場合、下記のお問い合わせ窓口から依頼できます。本人確認のため、Googleログインに使用したメールアドレス等の提示をお願いする場合があります。法令またはサービス運営上保存が必要な情報を除き、合理的な範囲で対応します。
            </p>
            <p className={paragraphClass}>
              端末内のローカルストレージに保存された情報は、ブラウザのサイトデータ削除機能等から利用者自身で削除できます。
            </p>
          </section>

          <section id="minors" className={sectionClass}>
            <h2 className={headingClass}>9. 未成年者の利用</h2>
            <p className={paragraphClass}>
              未成年者が本サービスを利用する場合は、必要に応じて保護者等の法定代理人の同意を得たうえで利用してください。投資に関する判断や取引を行う際は、年齢に応じた法令・証券会社等の定めも確認してください。
            </p>
          </section>

          <section id="changes" className={sectionClass}>
            <h2 className={headingClass}>10. 本ポリシーの変更</h2>
            <p className={paragraphClass}>
              本サービスは、法令、サービス内容または情報の取扱いの変更等に応じて、本ポリシーを変更することがあります。重要な変更がある場合は、本サービス上での掲示その他の適切と考えられる方法でお知らせします。変更後の内容は、本ページに掲載した時点から適用されます。
            </p>
          </section>

          <section id="contact" className={sectionClass}>
            <h2 className={headingClass}>11. お問い合わせ</h2>
            <p className={paragraphClass}>
              本ポリシー、利用者情報の取扱いまたは削除依頼に関するお問い合わせは、SIGNALXのお問い合わせページからご連絡ください。
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              お問い合わせページへ
            </Link>
          </section>
        </article>
      </div>
    </main>
  );
}
