// TEST STUB ONLY - deliberately NOT the real Google Play Billing SDK.
package com.android.billingclient.api;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
public final class ProductDetails {
    private final String productId;
    private final String productType;
    private final List<SubscriptionOfferDetails> offers;
    public ProductDetails(String productId,String productType,String...eligibleTokens){
        this.productId=productId;
        this.productType=productType;
        List<SubscriptionOfferDetails> list=new ArrayList<>();
        for(String token:eligibleTokens)list.add(new SubscriptionOfferDetails(token));
        this.offers=Collections.unmodifiableList(list);
    }
    public String getProductId(){return productId;}
    public String getProductType(){return productType;}
    public List<SubscriptionOfferDetails> getSubscriptionOfferDetails(){return offers;}
    public static final class SubscriptionOfferDetails {
        private final String token;
        public SubscriptionOfferDetails(String token){this.token=token;}
        public String getOfferToken(){return token;}
    }
}
