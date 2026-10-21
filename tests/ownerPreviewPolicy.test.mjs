import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedResearchOwner, RESEARCH_PRIVATE_HEADERS } from "../app/lib/research/ownerPreviewPolicy.mjs";

test("only explicitly verified admin status grants access", () => {
  for (const value of [false, undefined, null, "true", 1, {}, []]) {
    assert.equal(isAuthorizedResearchOwner(value), false);
  }
  assert.equal(isAuthorizedResearchOwner(true), true);
});

test("research responses must not be publicly cached", () => {
  assert.equal(RESEARCH_PRIVATE_HEADERS["Cache-Control"], "private, no-store");
});
