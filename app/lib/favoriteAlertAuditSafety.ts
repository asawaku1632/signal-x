/**
 * Persist quote provenance before any activation alert is sent.
 * A failed audit cancels the newly created monitor, leaving its watch state
 * armed for a later retry. A failed cancellation throws and stops this cron.
 */
export async function persistFavoriteAuditOrCancel(
  monitorId: string,
  persist: () => Promise<void>,
  cancel: (id: string) => Promise<unknown>,
): Promise<"recorded" | "cancelled"> {
  try {
    await persist();
    return "recorded";
  } catch (auditError) {
    try {
      await cancel(monitorId);
    } catch (cancelError) {
      throw new AggregateError(
        [auditError, cancelError],
        "Favorite alert audit and monitor cancellation both failed",
      );
    }
    return "cancelled";
  }
}
