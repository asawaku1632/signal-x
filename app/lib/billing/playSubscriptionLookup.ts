/** Server-side Google Play subscription v2 lookup only.
 * Callers MUST get OAuth access tokens via server-held credentials and bind
 * purchase tokens to an authenticated SIGNALX account in the database.
 * This never grants premium or records an entitlement.
 */
import { interpretVerifiedPlaySubscription, type PlaySubscriptionView } from "./playSubscriptionState.ts";

export type PlayLookupOutcome =
 | {ok:true; state:ReturnType<typeof interpretVerifiedPlaySubscription>; purchase:PlaySubscriptionView}
 | {ok:false; reason:"invalid_input"|"unverified"|"wrong_product"};

type HttpResponse = { ok:boolean; status:number; json():Promise<unknown> };
type HttpGet = (url:string,init:{method:"GET";headers:Record<string,string>;signal?:AbortSignal})=>Promise<HttpResponse>;

export async function lookupVerifiedPlaySubscription(
  args:{packageName:string; expectedPackageName:string; purchaseToken:string; productId:string; oauthAccessToken:string; now?:Date},
  httpGet:HttpGet,
):Promise<PlayLookupOutcome> {
  const {packageName,expectedPackageName,purchaseToken,productId,oauthAccessToken}=args;
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName) ||
      packageName!==expectedPackageName ||
      !purchaseToken || purchaseToken.length>4096 || /[\s/?#]/.test(purchaseToken) ||
      !productId?.trim() || !oauthAccessToken?.trim()) return {ok:false,reason:"invalid_input"};
  const url="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+
      encodeURIComponent(packageName)+"/purchases/subscriptionsv2/tokens/"+encodeURIComponent(purchaseToken);
  let raw:unknown;
  try {
    const response=await httpGet(url,{method:"GET",headers:{Authorization:"Bearer "+oauthAccessToken,Accept:"application/json"}});
    if (!response.ok) return {ok:false,reason:"unverified"};
    raw=await response.json();
  } catch { return {ok:false,reason:"unverified"}; }
  if (!raw || typeof raw!=="object" || Array.isArray(raw)) return {ok:false,reason:"unverified"};
  const purchase=raw as PlaySubscriptionView;
  if (!Array.isArray(purchase.lineItems) || !purchase.lineItems.some(x=>x.productId===productId))
    return {ok:false,reason:"wrong_product"};
  return {ok:true,purchase,state:interpretVerifiedPlaySubscription(purchase,productId,args.now)};
}
