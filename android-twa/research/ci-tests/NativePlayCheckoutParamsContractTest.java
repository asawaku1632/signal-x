// Stub-based syntax/contract check only; not an Android/Play Billing integration test.
package com.signalx.app.research;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.ProductDetails;
public final class NativePlayCheckoutParamsContractTest {
    static final String ACCOUNT_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static void bad(Runnable callable) {
        try { callable.run(); throw new AssertionError("Expected rejection"); }
        catch (IllegalArgumentException expected) { /* fail closed */ }
    }
    public static void main(String[] args) {
        if (!"com.signalx.app".equals(PlayCheckoutParamsFactory.EXPECTED_PACKAGE_ID)) {
            throw new AssertionError("Wrong package");
        }
        ProductDetails subscription = new ProductDetails("premium_month", BillingClient.ProductType.SUBS);
        BillingFlowParams params=PlayCheckoutParamsFactory.forSubscription(
            subscription, "premium_month", "eligible-offer", ACCOUNT_HASH);
        if (!ACCOUNT_HASH.equals(params.obfuscatedAccountId) || params.products.size()!=1 ||
            params.products.get(0).details!=subscription ||
            !"eligible-offer".equals(params.products.get(0).offerToken)) {
            throw new AssertionError("Wrong account or product in native checkout request");
        }
        bad(()->PlayCheckoutParamsFactory.forSubscription(subscription, "wrong", "eligible", ACCOUNT_HASH));
        bad(()->PlayCheckoutParamsFactory.forSubscription(subscription, "premium_month", "", ACCOUNT_HASH));
        bad(()->PlayCheckoutParamsFactory.forSubscription(subscription, "premium_month", "eligible", "user@email.com"));
        bad(()->PlayCheckoutParamsFactory.forSubscription(subscription, "premium_month", "eligible", ""));
        bad(()->PlayCheckoutParamsFactory.forSubscription(
            new ProductDetails("premium_month","inapp"), "premium_month", "eligible", ACCOUNT_HASH));
        System.out.println("Native checkout parameters isolated stub contract: PASS");
    }
}
