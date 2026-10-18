// ISOLATED fake AndroidX/Custom Tabs bridge test; NOT an Android device test.
package com.signalx.app.research;

import android.net.Uri;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsSession;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

public final class TwaAndroidXPostMessageResearchTest {
    private static final String ORIGIN="https://signal-x-ppjg.vercel.app";
    private static final String PREFIX="signalx.play.bridge.v1";
    private static final String TOKEN="T".repeat(43);

    private static void require(boolean v,String reason){
        if(!v)throw new AssertionError(reason);
    }
    private static final class Holder {
        final List<String> tickets=new ArrayList<>();
        final TwaAndroidXPostMessageResearch channel=new TwaAndroidXPostMessageResearch(
            true,new SecureRandom(),(t,expiry)->tickets.add(t)
        );
        final CustomTabsSession session=new CustomTabsSession();
        final CustomTabsCallback events=channel.callback();
    }
    private static String firstHelloNonce(CustomTabsSession session){
        require(session.messages.size()==1,"Exactly one HELLO");
        String msg=session.messages.get(0);
        java.util.regex.Matcher m=java.util.regex.Pattern.compile(
            "^\\{\"type\":\"signalx\\.play\\.bridge\\.v1/hello\",\"nonce\":\"([A-Za-z0-9_-]{22})\"\\}$"
        ).matcher(msg);
        require(m.matches(),"Malformed HELLO");
        return m.group(1);
    }
    private static String ack(String nonce){
        return "{\"type\":\""+PREFIX+"/hello-ack\",\"nonce\":\""+nonce+"\"}";
    }
    private static String ticket(String nonce,long exp){
        return "{\"type\":\""+PREFIX+"/checkout-ticket\",\"nonce\":\""+nonce+
               "\",\"ticket\":\""+TOKEN+"\",\"expiresAtMillis\":"+exp+"}";
    }
    private static Holder ready(){
        Holder h=new Holder();
        require(h.channel.attachAfterWarmup(h.session),"Relationship request rejected");
        require(h.session.validationRequests==1,"Validation never requested");
        require(ORIGIN.equals(h.session.requestedOrigin.toString()),"Wrong validation origin");
        h.events.onNavigationEvent(CustomTabsCallback.NAVIGATION_FINISHED,null);
        require(h.session.channelRequests==0,"Should not open before DAL");
        h.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_USE_AS_ORIGIN,Uri.parse(ORIGIN),true,null);
        require(h.session.channelRequests==1,"Channel not requested");
        require(ORIGIN.equals(h.session.channelSource.toString()) &&
            ORIGIN.equals(h.session.channelTarget.toString()),"Must constrain both origins");
        h.events.onMessageChannelReady(null);
        return h;
    }
    public static void main(String[] args){
        Holder h=ready();
        String nonce=firstHelloNonce(h.session);
        require(h.tickets.isEmpty(),"HELLO must not grant or start payment");
        h.events.onPostMessage(ack(nonce),null);
        require(h.session.messages.size()==2,"Missing READY");
        require(h.session.messages.get(1).equals(
            "{\"type\":\""+PREFIX+"/ready\",\"nonce\":\""+nonce+"\"}"),"Malformed READY");

        long expiry=System.currentTimeMillis()+90_000;
        h.events.onPostMessage(ticket(nonce,expiry),null);
        require(h.tickets.size()==1 && h.tickets.get(0).equals(TOKEN),"Valid token lost");
        require(h.channel.isClosed(),"Must close after consuming");
        h.events.onPostMessage(ticket(nonce,expiry),null);
        require(h.tickets.size()==1,"Token replay accepted");

        Holder missingProof=new Holder();
        require(missingProof.channel.attachAfterWarmup(missingProof.session),"Start fail");
        missingProof.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_USE_AS_ORIGIN,Uri.parse(ORIGIN),false,null);
        require(missingProof.channel.isClosed(),"Unverified DAL must close");
        missingProof.events.onNavigationEvent(CustomTabsCallback.NAVIGATION_FINISHED,null);
        require(missingProof.session.channelRequests==0,"Untrusted browser opened channel");

        Holder wrongRelation=new Holder();
        require(wrongRelation.channel.attachAfterWarmup(wrongRelation.session),"Start fail");
        wrongRelation.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_HANDLE_ALL_URLS,Uri.parse(ORIGIN),true,null);
        require(wrongRelation.channel.isClosed(),"Handle URL relation is NOT use_as_origin");

        Holder wrongOrigin=new Holder();
        require(wrongOrigin.channel.attachAfterWarmup(wrongOrigin.session),"Start fail");
        wrongOrigin.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_USE_AS_ORIGIN,Uri.parse("https://evil.example"),true,null);
        require(wrongOrigin.channel.isClosed(),"Wrong origin accepted");

        Holder cannotValidate=new Holder();
        cannotValidate.session.validateAccept=false;
        require(!cannotValidate.channel.attachAfterWarmup(cannotValidate.session),"Failed request accepted");
        require(cannotValidate.channel.isClosed(),"Failed relationship request not closed");

        Holder cannotOpen=new Holder();
        cannotOpen.session.channelAccept=false;
        require(cannotOpen.channel.attachAfterWarmup(cannotOpen.session),"Start fail");
        cannotOpen.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_USE_AS_ORIGIN,Uri.parse(ORIGIN),true,null);
        cannotOpen.events.onNavigationEvent(CustomTabsCallback.NAVIGATION_FINISHED,null);
        require(cannotOpen.channel.isClosed(),"Failed channel request not closed");

        Holder failedSend=new Holder();
        failedSend.session.sendResult=CustomTabsService.RESULT_FAILURE_DISALLOWED;
        require(failedSend.channel.attachAfterWarmup(failedSend.session),"Start fail");
        failedSend.events.onRelationshipValidationResult(
            CustomTabsService.RELATION_USE_AS_ORIGIN,Uri.parse(ORIGIN),true,null);
        failedSend.events.onNavigationEvent(CustomTabsCallback.NAVIGATION_FINISHED,null);
        failedSend.events.onMessageChannelReady(null);
        require(failedSend.channel.isClosed(),"Failed HELLO send not closed");

        Holder spoof=ready();
        String sNonce=firstHelloNonce(spoof.session);
        spoof.events.onPostMessage(ack("Q".repeat(22)),null);
        require(spoof.channel.isClosed(),"Wrong ACK accepted");
        require(spoof.tickets.isEmpty(),"Wrong ACK issued ticket");

        Holder beforeReady=ready();
        String brNonce=firstHelloNonce(beforeReady.session);
        beforeReady.events.onPostMessage(ticket(brNonce,System.currentTimeMillis()+60_000),null);
        require(beforeReady.channel.isClosed(),"Ticket accepted without ACK");

        Holder malformed=ready();
        String mNonce=firstHelloNonce(malformed.session);
        malformed.events.onPostMessage(ack(mNonce)+",\"premium\":true",null);
        require(malformed.channel.isClosed(),"Malformed JSON frame accepted");

        Holder nav=ready();
        nav.events.onNavigationEvent(CustomTabsCallback.NAVIGATION_STARTED,null);
        require(nav.channel.isClosed(),"Navigation did not kill session");

        Holder disabled=new Holder();
        TwaAndroidXPostMessageResearch off=new TwaAndroidXPostMessageResearch(
            false,new SecureRandom(),(t,expiration)->{throw new AssertionError("disabled");}
        );
        require(!off.attachAfterWarmup(disabled.session),"Disabled integration started");

        System.out.println("AndroidX Custom Tabs session callback research contract: PASS");
    }
}
