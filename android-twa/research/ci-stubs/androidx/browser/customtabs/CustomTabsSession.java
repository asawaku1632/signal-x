// ISOLATED CI STUB. NOT an AndroidX implementation or browser binder.
package androidx.browser.customtabs;
import android.net.Uri;
import android.os.Bundle;
import java.util.ArrayList;
import java.util.List;
public class CustomTabsSession {
  public boolean validateAccept=true;
  public boolean channelAccept=true;
  public int sendResult=CustomTabsService.RESULT_SUCCESS;
  public int validationRequests;
  public int channelRequests;
  public Uri requestedOrigin,channelSource,channelTarget;
  public final List<String> messages=new ArrayList<>();
  public boolean validateRelationship(int relation,Uri origin,Bundle extras){
    validationRequests++;requestedOrigin=origin;
    if(relation!=CustomTabsService.RELATION_USE_AS_ORIGIN)return false;
    return validateAccept;
  }
  public boolean requestPostMessageChannel(Uri source,Uri target,Bundle extras){
    channelRequests++;channelSource=source;channelTarget=target;return channelAccept;
  }
  public int postMessage(String message,Bundle extras){
    messages.add(message);return sendResult;
  }
}