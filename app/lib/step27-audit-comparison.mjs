
// STEP27-B/C: pure audit comparison and investigation classification.
// No database access, network requests, writes, or trading actions.

export function compareAuditGroups(previous, current) {
  const keyOf = g => g.jst_date + ":" + g.index_key;
  const old = new Map(previous.map(g => [keyOf(g), g.saved_count]));
  const now = new Map(current.map(g => [keyOf(g), g.saved_count]));

  const changes = [
    ...current
      .filter(g => !old.has(keyOf(g)))
      .map(g => ({
        key: keyOf(g),
        type: "ADDED",
        before: null,
        after: g.saved_count,
      })),
    ...current
      .filter(g => old.has(keyOf(g)) && old.get(keyOf(g)) !== g.saved_count)
      .map(g => ({
        key: keyOf(g),
        type: "COUNT_CHANGED",
        before: old.get(keyOf(g)),
        after: g.saved_count,
      })),
    ...previous
      .filter(g => !now.has(keyOf(g)))
      .map(g => ({
        key: keyOf(g),
        type: "MISSING",
        before: g.saved_count,
        after: null,
      })),
  ];

  const duplicateGroups = current.filter(g => g.saved_count > 1).length;

  return {
    decision:
      current.length === 0
        ? "NO_DATA"
        : duplicateGroups > 0
          ? "DUPLICATE_DETECTED"
          : "PASS",
    duplicateGroups,
    status: changes.length ? "CHANGED" : "UNCHANGED",
    changes,
  };
}

// STEP27-C: classify results into manual investigation guidance.
export function classifyAuditInvestigation(comparison, current) {
  if (current.length === 0) {
    return {
      state: "NO_DATA",
      items: [{
        code: "NO_DATA",
        action: "保存元・抽出条件・接続先を確認してください。",
      }],
    };
  }

  const items = [];

  for (const group of current) {
    if (group.saved_count > 1) {
      items.push({
        code: "DUPLICATE",
        key: group.jst_date + ":" + group.index_key,
        action: "重複防止条件と保存履歴を確認してください。",
      });
    }
  }

  if (comparison) {
    const actions = {
      ADDED: "通常の履歴追加か確認してください。",
      COUNT_CHANGED: "保存件数と重複防止条件を確認してください。",
      MISSING: "削除履歴・抽出条件・接続先を確認してください。",
    };

    for (const change of comparison.changes) {
      items.push({
        code: change.type,
        key: change.key,
        action: actions[change.type],
      });
    }
  }

  const requiresInvestigation = items.some(item =>
    ["DUPLICATE", "COUNT_CHANGED", "MISSING"].includes(item.code)
  );

  return {
    state: requiresInvestigation
      ? "INVESTIGATE"
      : !comparison
        ? "NO_BASELINE"
        : items.length > 0
          ? "REVIEW_CHANGES"
          : "STABLE",
    items,
  };
}
