import { createVerify } from "node:crypto";
import { RunnerState } from "./state-machine.mjs";
import { TARGET_ROLE, VERCEL_TARGET } from "./production-adapters.mjs";
import { validateTrustedOperatorPublicKey } from "./trusted-operator-key.mjs";

export const PRODUCTION_IDENTITY = Object.freeze({
  productionProject: "paygtakajhvatwejygda",
  role: TARGET_ROLE,
  vercelProject: VERCEL_TARGET.project,
  vercelProjectId: VERCEL_TARGET.projectId,
  environment: VERCEL_TARGET.environment,
  targetVariable: VERCEL_TARGET.variable,
});

function canonical(manifest) {
  return Buffer.from(JSON.stringify({
    command: manifest.command, productionProject: manifest.productionProject,
    role: manifest.role, vercelProject: manifest.vercelProject,
    vercelProjectId: manifest.vercelProjectId, environment: manifest.environment,
    targetVariable: manifest.targetVariable,
    currentState: manifest.currentState, nonce: manifest.nonce, expiresAt: manifest.expiresAt,
  }), "utf8");
}

export function createProductionOperatorAuthorizer({ trustedPublicKey, approvedFingerprint, now = () => Date.now() }) {
  const validatedKey = validateTrustedOperatorPublicKey({ pem:trustedPublicKey, approvedFingerprint });
  const usedNonces = new Set(); let activated = false;
  return async ({ command, authorization, currentState }) => {
    if (command !== "ACTIVATE") return activated;
    if (activated || currentState !== RunnerState.PREFLIGHT) return false;
    const manifest = authorization?.manifest;
    if (!manifest || !Buffer.isBuffer(authorization.signature)) return false;
    if (manifest.command !== "ACTIVATE" || manifest.currentState !== RunnerState.PREFLIGHT) return false;
    for (const [key, value] of Object.entries(PRODUCTION_IDENTITY)) if (manifest[key] !== value) return false;
    if (typeof manifest.nonce !== "string" || manifest.nonce.length < 16 || usedNonces.has(manifest.nonce)) return false;
    if (!Number.isSafeInteger(manifest.expiresAt) || manifest.expiresAt < now() || manifest.expiresAt > now() + 300_000) return false;
    const verifier = createVerify("SHA256"); verifier.update(canonical(manifest)); verifier.end();
    if (!verifier.verify(validatedKey.key, authorization.signature)) return false;
    usedNonces.add(manifest.nonce); activated = true; return true;
  };
}

export function canonicalActivationManifest(manifest) { return canonical(manifest); }
