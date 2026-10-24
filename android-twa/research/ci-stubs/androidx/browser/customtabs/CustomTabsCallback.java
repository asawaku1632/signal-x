// ISOLATED CI STUB, not AndroidX.
package androidx.browser.customtabs;
import android.net.Uri;
import android.os.Bundle;
public class CustomTabsCallback {
  public static final int NAVIGATION_STARTED=1;
  public static final int NAVIGATION_FINISHED=2;
  public static final int NAVIGATION_FAILED=3;
  public static final int NAVIGATION_ABORTED=4;
  public static final int TAB_HIDDEN=6;
  public void onRelationshipValidationResult(int relation,Uri origin,boolean result,Bundle extras){}
  public void onNavigationEvent(int navigationEvent,Bundle extras){}
  public void onMessageChannelReady(Bundle extras){}
  public void onPostMessage(String message,Bundle extras){}
}