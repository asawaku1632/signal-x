export function shouldReplaceSnapshot(
  existingItemCount: number | null,
  refreshedItemCount: number,
) {
  return existingItemCount === null || refreshedItemCount >= existingItemCount;
}
