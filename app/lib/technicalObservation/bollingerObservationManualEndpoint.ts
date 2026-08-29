import type { BollingerManualDependencies } from "./bollingerObservationManual.ts";
import { executeBollingerManualOperation } from "./bollingerObservationManual.ts";

export type BollingerManualAccess = { authenticated: boolean; isAdmin: boolean };

export function authorizeBollingerManualAccess(access: BollingerManualAccess) {
  if (!access.authenticated) return { status: 401, error: "Authentication required" } as const;
  if (!access.isAdmin) return { status: 403, error: "Administrator access required" } as const;
  return null;
}

export async function handleBollingerManualRequest(input: unknown, access: BollingerManualAccess,
  dependencies: BollingerManualDependencies = {}) {
  const denial = authorizeBollingerManualAccess(access);
  if (denial) return { status: denial.status, body: { success: false, error: denial.error } };
  try {
    const result = await executeBollingerManualOperation(input, dependencies);
    return { status: 200, body: { success: true, request: result.request, audit: result.audit,
      runner: result.runner } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("INVALID_MANUAL_REQUEST:")) {
      return { status: 400, body: { success: false, error: message } };
    }
    return { status: 500, body: { success: false, error: "Manual execution failed" } };
  }
}
