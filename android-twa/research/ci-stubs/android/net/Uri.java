// ISOLATED CI STUB, not Android SDK.
package android.net;
public final class Uri {
  private final String value;
  private Uri(String v){value=v;}
  public static Uri parse(String v){return new Uri(v);}
  @Override public String toString(){return value;}
}