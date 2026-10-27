// STEP27-B: pure comparison logic. No database, network, or side effects.
export function compareAuditGroups(previous, current) {
  const keyOf = g => g.jst_date + ":" + g.index_key;
  const old = new Map(previous.map(g => [keyOf(g), g.saved_count]));
  const now = new Map(current.map(g => [keyOf(g), g.saved_count]));
  const changes = [
    ...current.filter(g => !old.has(keyOf(g))).map(g => ({ key: keyOf(g), type: "ADDED", before: null, after: g.saved_count })),
    ...current.filter(g => old.has(keyOf(g)) && old.get(keyOf(g)) !== g.saved_count).map(g => ({ key: keyOf(g), type: "COUNT_CHANGED", before: old.get(keyOf(g)), after: g.saved_count })),
    ...previous.filter(g => !now.has(keyOf(g))).map(g => ({ key: keyOf(g), type: "MISSING", before: g.saved_count, after: null })),
  ];
  const duplicateGroups = current.filter(g => g.saved_count > 1).length;
  return {
    decision: current.length === 0 ? "NO_DATA" : duplicateGroups > 0 ? "DUPLICATE_DETECTED" : "PASS",
    duplicateGroups,
    status: changes.length ? "CHANGED" : "UNCHANGED",
    changes,
  };
}
