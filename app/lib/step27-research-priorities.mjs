// STEP27-F: prioritization is advisory only; it cannot authorize market-data use.
export function prioritizeMarketIndexResearch(nextStep) {
  const tasks = [
    { id: "LICENSE", priority: 1, title: "指数データの利用許諾", action: "日経平均・TOPIXの権利元に、保存・AI分析・有料配信・再表示の利用条件を確認する。", status: "BLOCKED_EXTERNAL_EVIDENCE" },
    { id: "CALENDAR", priority: 2, title: "正式な取引日カレンダー", action: "取引所の正式な営業日・臨時休場情報の取得条件と根拠を確認する。", status: "NOT_VERIFIED" },
    { id: "PROVIDER", priority: 3, title: "正規データ提供元", action: "許諾範囲を満たす提供元、契約条件、取得頻度を比較する。", status: "NOT_SELECTED" },
    { id: "QUALITY", priority: 4, title: "正式データの品質検証", action: "許諾取得後に、時刻・欠損・整合性の独立検証計画を作る。", status: "BLOCKED_BY_LICENSE" },
    { id: "AUDIT_HISTORY", priority: 5, title: "監査履歴の独立性", action: nextStep?.state === "INSUFFICIENT_EVIDENCE"
      ? "異なる機会の監査を待つ。同じデータを件数稼ぎで再保存しない。"
      : "監査結果の差分と再発を確認する。", status: nextStep?.state === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "MONITOR" },
  ];
  return { status: "RESEARCH_ONLY", recommendedFirst: "LICENSE", tasks,
    note: "優先順位は研究計画であり、許諾取得・実データ検証・本番利用承認を意味しません。" };
}
