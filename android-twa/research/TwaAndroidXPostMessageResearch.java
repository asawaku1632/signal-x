/*
 * RESEARCH-ONLY AndroidX Custom Tabs bridge. Intentionally outside app/src/main.
 * NOT wired into Bubblewrap LauncherActivity, no manifest/dependency changes,
 * no Play purchase, backend calls or authenticated browser session here.
 *
 * The caller MUST create this adapter's callback and attach the SAME session
 * returned by CustomTabsClient.newSession(adapter.callback()) after client.warmup.
 * The installed TWA/Chrome session and Play signing certificate still require
 * end-to-end device validation. A boolean DAL callback is not a user identity.
 */
package com.signalx.app.research;

import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsSession;
import java.security.SecureRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TwaAndroidXPostMessageResearch {
    private static final Uri ORIGIN = Uri.parse(TwaCheckoutMessagePolicy.ORIGIN);
    private static final String PREFIX = "signalx.play.bridge.v1";
    // Wire contract: string JSON with exact keys/order emitted by the Web
    // research adapter's JSON.stringify. No loose JSON parsing or extra keys.
    private static final Pattern ACK = Pattern.compile(
        "^\\{\"type\":\"signalx\\.play\\.bridge\\.v1/hello-ack\",\"nonce\":\"([A-Za-z0-9_-]{22})\"\\}$");
    private static final Pattern TICKET = Pattern.compile(
        "^\\{\"type\":\"signalx\\.play\\.bridge\\.v1/checkout-ticket\",\"nonce\":\"([A-Za-z0-9_-]{22})\",\"ticket\":\"([A-Za-z0-9_-]{43})\",\"expiresAtMillis\":([1-9][0-9]{0,15})\\}$");
    private static final int MAX_MESSAGE_BYTES = 512;

    public interface TicketListener {
        /** Never persist/log token. Must redeem with fresh server-verified Play Integrity. */
        void onOneUseTicket(String ticket, long expiresAtMillis);
    }
    private final TicketListener listener;
    private final TwaCheckoutMessagePolicy policy;
    private CustomTabsSession session;
    private boolean connected;
    private boolean navigationFinished;
    private boolean relationshipValidated;
    private boolean channelRequested;
    private boolean channelReady;
    private boolean closed;

    public TwaAndroidXPostMessageResearch(boolean featureEnabled,
            SecureRandom random, TicketListener ticketListener) {
        if(random==null || ticketListener==null)
            throw new IllegalArgumentException("SecureRandom and listener required");
        this.listener=ticketListener;
        policy=new TwaCheckoutMessagePolicy(random);
        if(!featureEnabled) close();
    }

    public final CustomTabsCallback callback = new CustomTabsCallback() {
        @Override
        public void onRelationshipValidationResult(
                int relation, Uri requestedOrigin, boolean result, Bundle extras) {
            if(closed || !connected || relationshipValidated) return;
            String requested=requestedOrigin==null?"":requestedOrigin.toString();
            if(!policy.acceptRelationshipResult(relation, requested, result)) {
                close();return;
            }
            relationshipValidated=true;
            maybeRequestChannel();
        }
        @Override
        public void onNavigationEvent(int navigationEvent, Bundle extras) {
            if(closed || !connected) return;
            if(navigationEvent==CustomTabsCallback.NAVIGATION_STARTED) {
                // Initial navigation can start before any channel. A navigation
                // AFTER a completed first page destroys any pending checkout.
                if(navigationFinished || channelRequested) close();
            } else if(navigationEvent==CustomTabsCallback.NAVIGATION_FINISHED) {
                if(navigationFinished) {close();return;}
                navigationFinished=true;
                maybeRequestChannel();
            } else if(navigationEvent==CustomTabsCallback.NAVIGATION_FAILED ||
                      navigationEvent==CustomTabsCallback.NAVIGATION_ABORTED ||
                      navigationEvent==CustomTabsCallback.TAB_HIDDEN) {
                close();
            }
        }
        @Override
        public void onMessageChannelReady(Bundle extras) {
            if(closed || !connected || !channelRequested || channelReady || session==null) {
                close();return;
            }
            if(!policy.acceptChannelReady(ORIGIN.toString(),ORIGIN.toString())) {
                close();return;
            }
            channelReady=true;
            TwaCheckoutMessagePolicy.Message hello=policy.beginHello();
            if(hello==null) {close();return;}
            String json="{\"type\":\""+PREFIX+"/hello\",\"nonce\":\""+hello.nonce+"\"}";
            if(session.postMessage(json,null)!=CustomTabsService.RESULT_SUCCESS) close();
        }
        @Override
        public void onPostMessage(String message,Bundle extras) {
            if(closed || !channelReady || message==null ||
               message.length()==0 || message.length()>MAX_MESSAGE_BYTES) {
                close();return;
            }
            Matcher ack=ACK.matcher(message);
            if(ack.matches()) {
                TwaCheckoutMessagePolicy.Message ready=policy.onHelloAck(
                    PREFIX+"/hello-ack",ack.group(1),ORIGIN.toString());
                if(ready==null || session==null) {close();return;}
                String json="{\"type\":\""+PREFIX+"/ready\",\"nonce\":\""+ready.nonce+"\"}";
                if(session.postMessage(json,null)!=CustomTabsService.RESULT_SUCCESS)
                    close();
                return;
            }
            Matcher ticket=TICKET.matcher(message);
            if(!ticket.matches()) {close();return;}
            final long expiry;
            try {expiry=Long.parseLong(ticket.group(3));}
            catch(NumberFormatException invalid){close();return;}
            TwaCheckoutMessagePolicy.Ticket oneUse=policy.onCheckoutTicket(
                PREFIX+"/checkout-ticket",ticket.group(1),ticket.group(2),
                expiry,System.currentTimeMillis(),ORIGIN.toString());
            if(oneUse==null) {close();return;}
            // Never allow subsequent messages, navigation or UI to reuse token.
            close();
            try {listener.onOneUseTicket(oneUse.opaqueTicket,expiry);}
            catch(RuntimeException ignored) { /* never log raw ticket */ }
        }
    };

    public CustomTabsCallback callback() {return callback;}

    /**
     * Only invoked after the host bound the browser, called warmup(0) and
     * created this exact CustomTabsSession with callback(). The session must
     * be the one used to launch the TWA, not a detached Custom Tab.
     */
    public boolean attachAfterWarmup(CustomTabsSession sameLaunchedSession) {
        if(closed || connected || sameLaunchedSession==null) return false;
        session=sameLaunchedSession;
        connected=true;
        if(!session.validateRelationship(
                CustomTabsService.RELATION_USE_AS_ORIGIN,ORIGIN,null)) {
            close();return false;
        }
        return true; // request accepted, relationship still NOT verified
    }

    private void maybeRequestChannel() {
        if(closed || !connected || !navigationFinished ||
           !relationshipValidated || channelRequested || session==null) return;
        channelRequested=true;
        if(!session.requestPostMessageChannel(ORIGIN,ORIGIN,new Bundle())) close();
    }

    /** Also invoke for browser service disconnect, activity pause, or logout. */
    public void close() {
        if(closed) return;
        closed=true;
        policy.close();
        session=null;
    }
    public boolean isClosed() {return closed;}
}
