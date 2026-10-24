// TEST STUB ONLY - not actual Google Play SDK.
package com.android.billingclient.api;
import java.util.List;
public final class BillingFlowParams {
    public final String obfuscatedAccountId;
    public final List<ProductDetailsParams> products;
    private BillingFlowParams(String accountId,List<ProductDetailsParams> products){
        this.obfuscatedAccountId=accountId;this.products=products;
    }
    public static Builder newBuilder(){return new Builder();}
    public static final class Builder {
        private String accountId;
        private List<ProductDetailsParams> products;
        public Builder setObfuscatedAccountId(String v){accountId=v;return this;}
        public Builder setProductDetailsParamsList(List<ProductDetailsParams> v){products=v;return this;}
        public BillingFlowParams build(){return new BillingFlowParams(accountId,products);}
    }
    public static final class ProductDetailsParams {
        public final ProductDetails details;
        public final String offerToken;
        private ProductDetailsParams(ProductDetails product,String offer){details=product;offerToken=offer;}
        public static Builder newBuilder(){return new Builder();}
        public static final class Builder {
            private ProductDetails product;
            private String offer;
            public Builder setProductDetails(ProductDetails v){product=v;return this;}
            public Builder setOfferToken(String v){offer=v;return this;}
            public ProductDetailsParams build(){return new ProductDetailsParams(product,offer);}
        }
    }
}
