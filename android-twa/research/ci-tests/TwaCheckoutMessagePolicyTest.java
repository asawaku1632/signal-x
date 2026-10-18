// ISOLATED Java state-machine test. NO Android SDK or real browser involved.
package com.signalx.app.research;

import java.security.SecureRandom;

public final class TwaCheckoutMessagePolicyTest {
    private static final String ORIGIN=TwaCheckoutMessagePolicy.ORIGIN;
    private static final String PREFIX="signalx.play.bridge.v1";
    private static final int USE_AS_ORIGIN=2; // CI-only placeholder for AndroidX RELATION_USE_AS_ORIGIN
    private static final long NOW=1792288800000L;
    private static final String TICKET="T".repeat(43);

    private static void yes(boolean v){ if(!v)throw new AssertionError("Expected true"); }
    private static void no(boolean v){ if(v)throw new AssertionError("Expected false"); }
    private static void eq(Object expected,Object actual){
        if(!expected.equals(actual))throw new AssertionError("Expected "+expected+" got "+actual);
    }
    private static TwaCheckoutMessagePolicy verified(){
        TwaCheckoutMessagePolicy p=new TwaCheckoutMessagePolicy(new SecureRandom());
        yes(p.acceptRelationshipResult(USE_AS_ORIGIN,USE_AS_ORIGIN,ORIGIN,true));
        yes(p.acceptChannelReady(ORIGIN,ORIGIN));
        return p;
    }
    private static TwaCheckoutMessagePolicy.Message ready(TwaCheckoutMessagePolicy p){
        TwaCheckoutMessagePolicy.Message hello=p.beginHello();
        if(hello==null)throw new AssertionError("Missing hello");
        eq(PREFIX+"/hello",hello.type);
        eq(22,hello.nonce.length());
        return hello;
    }
    public static void main(String[] args){
        TwaCheckoutMessagePolicy good=verified();
        TwaCheckoutMessagePolicy.Message hello=ready(good);
        no(good.activeForOneTicket());
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW+1000,NOW,ORIGIN)!=null)
            throw new AssertionError("Ticket before ready");
        if(good.onHelloAck(PREFIX+"/hello-ack","bad",ORIGIN)!=null)
            throw new AssertionError("Wrong nonce");
        if(good.onHelloAck(PREFIX+"/hello-ack",hello.nonce,"https://evil.example")!=null)
            throw new AssertionError("Wrong session origin");
        TwaCheckoutMessagePolicy.Message ack=good.onHelloAck(PREFIX+"/hello-ack",hello.nonce,ORIGIN);
        if(ack==null)throw new AssertionError("Handshake failed");
        eq(PREFIX+"/ready",ack.type);
        eq(hello.nonce,ack.nonce);
        yes(good.activeForOneTicket());
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,"not valid",NOW+1000,NOW,ORIGIN)!=null)
            throw new AssertionError("Malformed ticket");
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW+120001,NOW,ORIGIN)!=null)
            throw new AssertionError("Excess TTL");
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW,NOW,ORIGIN)!=null)
            throw new AssertionError("Expired ticket");
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW+1000,NOW,"https://evil.example")!=null)
            throw new AssertionError("Origin switch");
        TwaCheckoutMessagePolicy.Ticket obtained=good.onCheckoutTicket(
            PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW+1000,NOW,ORIGIN);
        if(obtained==null)throw new AssertionError("Expected ticket acceptance");
        eq(TICKET,obtained.opaqueTicket);
        no(good.activeForOneTicket());
        if(good.onCheckoutTicket(PREFIX+"/checkout-ticket",hello.nonce,TICKET,NOW+1000,NOW,ORIGIN)!=null)
            throw new AssertionError("Ticket replay");

        TwaCheckoutMessagePolicy wrongOrigin=new TwaCheckoutMessagePolicy(new SecureRandom());
        no(wrongOrigin.acceptRelationshipResult(USE_AS_ORIGIN,USE_AS_ORIGIN,
            "https://attacker.example",true));
        no(wrongOrigin.acceptChannelReady(ORIGIN,ORIGIN));
        if(wrongOrigin.beginHello()!=null)throw new AssertionError("Should stay closed");

        TwaCheckoutMessagePolicy unverified=new TwaCheckoutMessagePolicy(new SecureRandom());
        no(unverified.acceptRelationshipResult(USE_AS_ORIGIN,USE_AS_ORIGIN,ORIGIN,false));
        if(unverified.beginHello()!=null)throw new AssertionError("No DAL");

        TwaCheckoutMessagePolicy wrongRelation=new TwaCheckoutMessagePolicy(new SecureRandom());
        no(wrongRelation.acceptRelationshipResult(1,USE_AS_ORIGIN,ORIGIN,true));

        TwaCheckoutMessagePolicy wrongTarget=new TwaCheckoutMessagePolicy(new SecureRandom());
        yes(wrongTarget.acceptRelationshipResult(USE_AS_ORIGIN,USE_AS_ORIGIN,ORIGIN,true));
        no(wrongTarget.acceptChannelReady(ORIGIN,"https://evil.example"));

        TwaCheckoutMessagePolicy disconnect=verified();
        TwaCheckoutMessagePolicy.Message disconnectHello=ready(disconnect);
        disconnect.onHelloAck(PREFIX+"/hello-ack",disconnectHello.nonce,ORIGIN);
        disconnect.close();
        if(disconnect.onCheckoutTicket(PREFIX+"/checkout-ticket",disconnectHello.nonce,TICKET,NOW+1000,NOW,ORIGIN)!=null)
            throw new AssertionError("Closed port sent ticket");
        System.out.println("TWA strict postMessage research handoff contract: PASS");
    }
}
