export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold">
        プライバシーポリシー
      </h1>

      <p className="mb-8 text-gray-600">
        SIGNALX（以下「本サービス」）は、利用者の個人情報を適切に取り扱い、
        個人情報保護に関する法令を遵守します。
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第1条（取得する情報）
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>メールアドレス</li>
          <li>お気に入り銘柄情報</li>
          <li>アクセスログ</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第2条（利用目的）
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>サービス提供のため</li>
          <li>機能改善のため</li>
          <li>お問い合わせ対応のため</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第3条（第三者提供）
        </h2>

        <p>
          法令に基づく場合を除き、利用者の同意なく第三者へ個人情報を提供しません。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第4条（安全管理）
        </h2>

        <p>
          個人情報の漏えい・紛失・改ざん防止のため適切な安全対策を実施します。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">
          第5条（お問い合わせ）
        </h2>

        <p>
          本ポリシーに関するお問い合わせは、SIGNALXまでお願いいたします。
        </p>
      </section>
    </main>
  );
}