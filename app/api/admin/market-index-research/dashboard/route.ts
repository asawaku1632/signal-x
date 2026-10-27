import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { buildResearchDashboardModel } from "@/app/lib/research/market-index-dashboard-model";
import { summarizeMarketIndexReadiness } from "@/app/lib/research/market-index-readiness";
import { reviewProviderDraft } from "@/app/lib/research/market-index-provider-review";
import { assessLicenseResponseDraft } from "@/app/lib/research/market-index-license-response";
import { buildIndexConnectionPlan } from "@/app/lib/research/market-index-connection-plan";
import { auditIndexResearchSafety } from "@/app/lib/research/market-index-safety-audit";
import { explainResearchSafetyFindings } from "@/app/lib/research/market-index-safety-explanations";
import { assessIndexEvidenceChecklist } from "@/app/lib/research/market-index-evidence-checklist";

export const dynamic = "force-dynamic";

/**
 * Read-only, admin-only research dashboard contract.
 * No DB/provider calls and no synthetic evidence presented as actual records.
 */
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "OWNER_ONLY" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = buildResearchDashboardModel([]);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: "RESEARCH_MODEL_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({
    success: true,
    sourceState: "NO_CONNECTED_EVIDENCE",
    hasLiveEvidence: false,
    model: result.model,
    evidenceChecklist: assessIndexEvidenceChecklist({}),
    safetyExplanations: explainResearchSafetyFindings(auditIndexResearchSafety({
      connection: {
        indexKey: null, providerId: "", authenticatedLicense: false,
        authenticatedCalendar: false, licensedFeedConfigured: false,
        validatedObservation: false, retentionScopeConfirmed: false,
        redistributionScopeConfirmed: false, operatorApproval: false,
      },
      license: {
        indexKey: null, providerId: "", contractReference: "",
        verifiedSigner: false, rightsForDisplay: false,
        rightsForAutomatedProcessing: false, rightsForRetention: false,
        rightsForRedistribution: false, rightsForPaidUsers: false,
        effectiveFrom: "", effectiveUntil: "", revocationChecked: false,
      },
    })),
    safetyAudit: auditIndexResearchSafety({
      connection: {
        indexKey: null, providerId: "", authenticatedLicense: false,
        authenticatedCalendar: false, licensedFeedConfigured: false,
        validatedObservation: false, retentionScopeConfirmed: false,
        redistributionScopeConfirmed: false, operatorApproval: false,
      },
      license: {
        indexKey: null, providerId: "", contractReference: "",
        verifiedSigner: false, rightsForDisplay: false,
        rightsForAutomatedProcessing: false, rightsForRetention: false,
        rightsForRedistribution: false, rightsForPaidUsers: false,
        effectiveFrom: "", effectiveUntil: "", revocationChecked: false,
      },
    }),
    connectionPlan: buildIndexConnectionPlan({
      indexKey: null, providerId: "",
      authenticatedLicense: false, authenticatedCalendar: false,
      licensedFeedConfigured: false, validatedObservation: false,
      retentionScopeConfirmed: false, redistributionScopeConfirmed: false,
      operatorApproval: false,
    }),
    licenseResponse: assessLicenseResponseDraft({
      indexKey: null, providerId: "", contractReference: "",
      verifiedSigner: false, rightsForDisplay: false,
      rightsForAutomatedProcessing: false, rightsForRetention: false,
      rightsForRedistribution: false, rightsForPaidUsers: false,
      effectiveFrom: "", effectiveUntil: "", revocationChecked: false,
    }),
    providerReview: reviewProviderDraft({
      providerName: "", coveredIndices: [], dataRedistributionAllowed: false,
      retentionAllowed: false, commercialDisplayAllowed: false,
      derivedAnalyticsAllowed: false, automatedFetchAllowed: false,
      contractualEvidenceReference: "", exchangeCalendarSource: "", rateLimitDocumented: false,
    }),
    readiness: summarizeMarketIndexReadiness({
      providerRightsVerified: false,
      licensedEvidenceAuthenticated: false,
      exchangeCalendarAuthenticated: false,
      observedMarketDataValidated: false,
      scheduledCaptureConfigured: false,
      databasePersistenceConfigured: false,
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
