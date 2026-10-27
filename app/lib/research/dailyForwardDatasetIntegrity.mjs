import { createHash } from "node:crypto";

/**
 * Hash the exact bytes of an offline research dataset.
 * Never infer license, provenance, or authenticity from a matching hash.
 * Caller must preserve the original byte representation and trusted expected hash.
 */
export function hashResearchDatasetBytes(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new TypeError("dataset must be Buffer or Uint8Array");
  }
  return createHash("sha256").update(bytes).digest("hex");
}

export function verifyResearchDatasetBytes(bytes, expectedSha256) {
  const actualSha256 = hashResearchDatasetBytes(bytes);
  const validExpected = typeof expectedSha256 === "string" &&
    /^[0-9a-f]{64}$/i.test(expectedSha256);
  const matches = validExpected && actualSha256 === expectedSha256.toLowerCase();
  return {
    status: matches ? "MATCH" : "MISMATCH_OR_INVALID_EXPECTED_HASH",
    matches, actualSha256,
    expectedSha256: validExpected ? expectedSha256.toLowerCase() : null,
    readyForProduction: false,
    note: "Hash equality proves only byte equality against a trusted reference, not source authenticity, licensing, or model quality.",
  };
}
