import "server-only";

import pool from "@/app/lib/postgres";
import {
  createSignalxUserResolver,
  type VerifiedGoogleIdentity,
} from "@/app/lib/signalxIdentityCore";

const resolveVerifiedGoogleUser = createSignalxUserResolver(pool);

export function resolveSignalxUser(
  identity: VerifiedGoogleIdentity,
): Promise<string> {
  return resolveVerifiedGoogleUser(identity);
}
