// Pure policy helper for research-only endpoints.
export function isAuthorizedResearchOwner(isAdmin) {
  return isAdmin === true;
}
export const RESEARCH_PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store",
});
