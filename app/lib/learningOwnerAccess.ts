// Pure, testable authorization rule. Accept exactly one configured address.
// A public ADMIN_EMAILS list must never implicitly broaden this owner-only gate.
export function isSingleAccountLearningOwner(
  sessionEmail: string | null | undefined,
  configuredOwner: string | null | undefined,
): boolean {
  const owner = configuredOwner?.trim().toLowerCase() ?? "";
  if (!/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(owner)) return false;
  return Boolean(sessionEmail && sessionEmail.trim().toLowerCase() === owner);
}
