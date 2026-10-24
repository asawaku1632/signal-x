/*
 * ISOLATED RESEARCH CODE ONLY: no dependency on AndroidX, no production
 * LauncherActivity wiring, no APK build, no Play Billing or purchase action.
 *
 * Android host MUST obtain the relationshipValidationSuccess flag from
 * CustomTabsCallback.onRelationshipValidationResult(RELATION_USE_AS_ORIGIN)
 * for the exact expected source origin after a verified Digital Asset Links
 * relationship. It MUST await onMessageChannelReady before beginHello.
 * String origin arguments MUST be derived from trusted browser/session state,
 * NEVER decoded from attacker JSON. The transport should parse JSON into
 * the exact fields used by onHelloAck and onCheckoutTicket; reject extras.
 *
 * The nonce challenge and URL-safe ticket are NOT sufficient to authenticate
 * the app to the server. Google's Play Integrity token bound to a one-use
 * server ticket is still mandatory, with all server-side checks.
 */
package com.signalx.app.research;

import java.security.SecureRandom;
import java.util.Base64;

public final class TwaCheckoutMessagePolicy {
    public static final String ORIGIN = "https://signal-x-ppjg.vercel.app";
    private static final String PREFIX = "signalx.play.bridge.v1";
    // AndroidX CustomTabsService.RELATION_USE_AS_ORIGIN == 1, NOT HANDLE_ALL_URLS (2).
    private static final int USE_AS_ORIGIN_RELATION = 1;
    private static final long MAX_TTL_MILLIS = 120_000L;

    private enum Phase { NEW, VERIFIED, CHANNEL_READY, HELLO_SENT, ACTIVE, CLAIMED, CLOSED }
    private Phase phase = Phase.NEW;
    private String nonce;
    private final SecureRandom random;

    public TwaCheckoutMessagePolicy(SecureRandom secureRandom) {
        if (secureRandom == null) throw new IllegalArgumentException("SecureRandom required");
        this.random = secureRandom;
    }

    public static final class Message {
        public final String type;
        public final String nonce;
        private Message(String type, String nonce) {
            this.type = type;
            this.nonce = nonce;
        }
        // Serialization must use Android org.json or equivalent strict encoder.
        // Do not create JSON via concatenation from untrusted strings.
    }

    public static final class Ticket {
        public final String opaqueTicket;
        private Ticket(String opaqueTicket) { this.opaqueTicket = opaqueTicket; }
    }

    private static boolean trustedOrigin(String origin) {
        return ORIGIN.equals(origin);
    }

    public boolean acceptRelationshipResult(
            int relation, String browserValidatedSourceOrigin,
            boolean validationSucceeded) {
        if (phase != Phase.NEW || relation != USE_AS_ORIGIN_RELATION ||
                !validationSucceeded || !trustedOrigin(browserValidatedSourceOrigin)) {
            close();
            return false;
        }
        phase = Phase.VERIFIED;
        return true;
    }

    /** Must only be called from CustomTabsCallback.onMessageChannelReady. */
    public boolean acceptChannelReady(String sourceOrigin, String targetOrigin) {
        if (phase != Phase.VERIFIED || !trustedOrigin(sourceOrigin) ||
                !trustedOrigin(targetOrigin)) {
            close();
            return false;
        }
        phase = Phase.CHANNEL_READY;
        return true;
    }

    /** Create a new challenge only after Chrome confirms channel readiness. */
    public Message beginHello() {
        if (phase != Phase.CHANNEL_READY) return null;
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        phase = Phase.HELLO_SENT;
        return new Message(PREFIX + "/hello", nonce);
    }

    /**
     * browserSessionOrigin must reflect the already verified CustomTabsSession;
     * caller must not let a message supply a different origin.
     */
    public Message onHelloAck(String type, String echoedNonce, String browserSessionOrigin) {
        if (phase != Phase.HELLO_SENT || !trustedOrigin(browserSessionOrigin) ||
                !((PREFIX + "/hello-ack").equals(type)) || nonce == null ||
                !nonce.equals(echoedNonce)) return null;
        phase = Phase.ACTIVE;
        return new Message(PREFIX + "/ready", nonce);
    }

    /**
     * Native must submit the accepted ticket to backend redemption with a
     * fresh Google Play Integrity requestHash. Never grant access on this call.
     * No secrets are exposed to browser logs, Activity intents, or analytics.
     */
    public Ticket onCheckoutTicket(String type, String echoedNonce,
            String rawTicket, long expiresAtMillis, long nowMillis,
            String browserSessionOrigin) {
        if (phase != Phase.ACTIVE || !trustedOrigin(browserSessionOrigin) ||
                !((PREFIX + "/checkout-ticket").equals(type)) ||
                nonce == null || !nonce.equals(echoedNonce) ||
                rawTicket == null || !rawTicket.matches("[A-Za-z0-9_-]{43}") ||
                nowMillis <= 0 || expiresAtMillis <= nowMillis ||
                expiresAtMillis - nowMillis > MAX_TTL_MILLIS)
            return null;
        phase = Phase.CLAIMED;
        return new Ticket(rawTicket);
    }

    /** Navigation, source change, app background, or transport error. */
    public void close() {
        nonce = null;
        phase = Phase.CLOSED;
    }

    public boolean activeForOneTicket() { return phase == Phase.ACTIVE; }
}
