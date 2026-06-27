export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-4xl font-bold">
        利用規約
      </h1>

      <p className="mb-8 text-gray-600">
        この利用規約（以下「本規約」）は、SIGNALX（以下「本サービス」）の利用条件を定めるものです。
        利用者は本規約に同意の上、本サービスをご利用ください。
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第1条（サービス内容）
        </h2>

        <p>
          SIGNALXは、日本株のテクニカル分析やAIによる分析情報を提供する情報提供サービスです。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第2条（投資判断）
        </h2>

        <p>
          本サービスで提供される情報は投資判断を支援する目的で提供されるものであり、
          将来の利益や株価上昇を保証するものではありません。
        </p>

        <p className="mt-3">
          最終的な投資判断は利用者ご自身の責任で行ってください。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第3条（禁止事項）
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>本サービスへの不正アクセス</li>
          <li>システムへの過度な負荷を与える行為</li>
          <li>法令に違反する行為</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold">
          第4条（免責事項）
        </h2>

        <p>
          SIGNALXは、本サービスの内容について可能な限り正確な情報提供に努めますが、
          情報の完全性・正確性・最新性を保証するものではありません。
        </p>

        <p className="mt-3">
          本サービスの利用により発生した損害について、
          SIGNALXは責任を負いません。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">
          第5条（規約の変更）
        </h2>

        <p>
          本規約は必要に応じて変更されることがあります。
        </p>
      </section>
    </main>
  );
}