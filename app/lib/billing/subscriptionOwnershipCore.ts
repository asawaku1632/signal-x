/**
 * Pure ownership binding policy. A verified provider subscription alone is
 * NOT an authorization grant. Only a server-established binding may update
 * the matching SIGNALX user.
 *
 * No DB calls, no provider API calls, no client-controlled user IDs.
 */
export type SubscriptionBinding = {
  provider: "stripe" | "google_play";
  externalSubscriptionId: string;
  signalxUserId: string;
};
export type OwnershipResult =
  | { kind: "matched"; signalxUserId: string }
  | { kind: "unknown_subscription" | "invalid_input" | "ambiguous_binding" };

const nonblank = (s: unknown): s is string =>
  typeof s === "string" && s.length > 0 && s.trim() === s;

export function resolveVerifiedSubscriptionOwner(
  provider: string,
  externalSubscriptionId: string,
  bindings: readonly SubscriptionBinding[],
): OwnershipResult {
  if (!["stripe", "google_play"].includes(provider) ||
      !nonblank(externalSubscriptionId)) return { kind: "invalid_input" };

  const matches = bindings.filter((b) =>
    b.provider === provider && b.externalSubscriptionId === externalSubscriptionId);
  if (matches.length === 0) return { kind: "unknown_subscription" };
  if (matches.length !== 1 || !nonblank(matches[0].signalxUserId))
    return { kind: "ambiguous_binding" };
  return { kind: "matched", signalxUserId: matches[0].signalxUserId };
}
