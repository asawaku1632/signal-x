/**
 * ISOLATED RESEARCH WEB ADAPTER ONLY: not imported into pages/routes.
 * Installs a browser window message listener and a private MessagePort listener.
 * There is NO checkout request, UI, API call, premium grant or fallback.
 *
 * Chrome TWA documentation: Android first initiates postMessage and gives
 * the webpage a port. Native must validate RELATION_USE_AS_ORIGIN and create a
 * target-origin-constrained CustomTabsSession before sending HELLO.
 * Website origin check protects only against cross-origin window messages;
 * the Google Play Integrity attestation on the server is still REQUIRED.
 */
import {
  acceptTwaNativeHello,
  TWA_PLAY_ORIGIN,
  type TwaWebCheckoutChannel,
} from "./twaPostMessageBridgeResearch.ts";

type PortLike = {
  postMessage(value:unknown):void;
  close():void;
  start?():void;
  onmessage:((event:{data:unknown})=>void)|null;
};
type BrowserEvent = {
  origin:string;
  source?:unknown;
  data:unknown;
  ports:readonly PortLike[];
};
type BrowserLike = {
  location:{origin:string};
  addEventListener(type:"message"|"pagehide",listener:(event:BrowserEvent)=>void):void;
  removeEventListener(type:"message"|"pagehide",listener:(event:BrowserEvent)=>void):void;
};
export type WebReceiver = {
  isReady():boolean;
  sendTicket(ticket:string,expiresAtMillis:number,now?:Date):boolean;
  dispose():void;
};

export function attachResearchTwaWebReceiver(
  browser:BrowserLike,
  featureEnabled:boolean,
):WebReceiver {
  let live=true;
  let channel:TwaWebCheckoutChannel|null=null;
  let activePort:PortLike|null=null;

  const abandon=()=>{
    channel?.close();
    channel=null;
    if(activePort) activePort.onmessage=null;
    activePort=null;
  };

  function handleWindowMessage(event:BrowserEvent):void {
    if(!live || !featureEnabled || browser.location.origin!==TWA_PLAY_ORIGIN)
      return;
    // A real native CustomTabs postMessage has no WindowProxy sender;
    // reject ordinary iframe/pop-up WindowProxy senders when present.
    if(event.source!=null) return;
    const received=acceptTwaNativeHello(event);
    if(received.kind!=="accepted") return;
    abandon();
    channel=received.channel;
    activePort=event.ports[0];
    const thisChannel=received.channel;
    const thisPort=activePort;
    thisPort.onmessage=({data})=>{
      if(!live || channel!==thisChannel) return;
      if(!thisChannel.acceptReady(data)) abandon();
    };
    try {
      thisPort.start?.();
      thisPort.postMessage(received.ackJson);
    } catch {
      abandon();
    }
  }
  const onHide=()=>abandon();
  if(featureEnabled && browser.location.origin===TWA_PLAY_ORIGIN) {
    browser.addEventListener("message",handleWindowMessage);
    browser.addEventListener("pagehide",onHide);
  }
  return {
    isReady:()=>Boolean(live && channel?.ready),
    sendTicket:(ticket,expiresAtMillis,now=new Date())=>
      Boolean(live && channel?.sendTicket(ticket,expiresAtMillis,now)),
    dispose:()=>{
      if(!live) return;
      live=false;
      browser.removeEventListener("message",handleWindowMessage);
      browser.removeEventListener("pagehide",onHide);
      abandon();
    },
  };
}
