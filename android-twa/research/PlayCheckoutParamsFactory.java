/*
 * RESEARCH-ONLY prototype. NOT in app/src/main, NOT connected to the TWA,
 * and NOT packaged into an Android release.
 *
 * All arguments MUST originate from:
 * - an authenticated server session and an authenticated origin-to-native bridge;
 * - a server-derived opaque account ID (HMAC of SIGNALX UUID with private key);
 * - a fresh BillingClient.queryProductDetailsAsync response and its eligible offer.
 *
 * This file only builds BillingFlowParams. It does NOT launch a purchase, grant
 * access, verify token ownership, acknowledge a purchase or persist anything.
 */
package com.signalx.app.research;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.ProductDetails;
import java.util.Collections;
import java.util.List;

public final class PlayCheckoutParamsFactory {
    public static final String EXPECTED_PACKAGE_ID = "com.signalx.app";

    private PlayCheckoutParamsFactory() { }

    public static BillingFlowParams forSubscription(
            ProductDetails productDetails,
            String expectedProductId,
            String eligibleOfferToken,
            String serverBoundObfuscatedAccountId) {
        if (productDetails == null ||
                expectedProductId == null || expectedProductId.isEmpty() ||
                !expectedProductId.equals(productDetails.getProductId()) ||
                !BillingClient.ProductType.SUBS.equals(productDetails.getProductType())) {
            throw new IllegalArgumentException("Verified subscription product required");
        }
        if (eligibleOfferToken == null || eligibleOfferToken.trim().isEmpty()) {
            throw new IllegalArgumentException("Eligible Play subscription offer token required");
        }
        // Only use an offer token returned for THIS freshly queried product.
        // Never accept a token freely chosen in JavaScript or retained from
        // another product / stale purchase page. Eligibility can later change,
        // and Google Play remains the final authority at launchBillingFlow.
        List<ProductDetails.SubscriptionOfferDetails> offers =
                productDetails.getSubscriptionOfferDetails();
        boolean presentInQueriedProduct = false;
        if (offers != null) {
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                if (offer != null && eligibleOfferToken.equals(offer.getOfferToken())) {
                    presentInQueriedProduct = true;
                    break;
                }
            }
        }
        if (!presentInQueriedProduct) {
            throw new IllegalArgumentException("Offer is absent from queried subscription details");
        }
        // Hex HMAC digest of SIGNALX's stable user UUID, issued ONLY by the server.
        // Raw email, stable subject, purchase token and OAuth credentials NEVER enter here.
        if (serverBoundObfuscatedAccountId == null ||
                !serverBoundObfuscatedAccountId.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Invalid server-issued obfuscated account ID");
        }

        BillingFlowParams.ProductDetailsParams product =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .setOfferToken(eligibleOfferToken)
                        .build();
        return BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(product))
                .setObfuscatedAccountId(serverBoundObfuscatedAccountId)
                .build();
    }
}
