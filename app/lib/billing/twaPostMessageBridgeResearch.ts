/**
 * ISOLATED RESEARCH-ONLY TWA postMessage protocol. No browser listeners, API
 * routes, payments, native bridge or production UI are installed by this file.
 *
 * Native must initialize its browser session ONLY after successfully validating
 * Digital Asset Links relation USE_AS_ORIGIN for the exact SIGNALX HTTPS origin
 * and after the Chrome postMessage channel-ready callback. The Android app sends
 * HELLO with a per-channel crypto-random nonce and a transferred MessagePort.
 * The web page refuses to hand over a checkout ticket until the port's READY
 * response echoes that nonce. The single-use ticket is still unusable without
 * backend-verified Play Integrity: port handshake is NOT native attestation.
 */
export const TWA_PLAY_ORIGIN = "https://signal-x-ppjg.vercel.app";
export const TWA_PLAY_PROTOCOL = "signalx.play.bridge.v1";

type PortLike = { postMessage(value: unknown): void; close?(): void };
type EventLike = {
  origin: string;
  data: unknown;
  ports: readonly PortLike[];
};
type Hello = {type:"signalx.play.bridge.v1/hello";nonce:string};
type Ack = {type:"signalx.play.bridge.v1/hello-ack";nonce:string};
type Ticket = {
  type:"signalx.play.bridge.v1/checkout-ticket";
  nonce:string;
  ticket:string;
  expiresAtMillis:number;
};
export type BridgeAccept =
  | {kind:"accepted";channel:TwaWebCheckoutChannel;ackJson:string}
  | {kind:"rejected"};
const NONCE_RE=/^[A-Za-z0-9_-]{22}$/; // 128-bit random nonce
const TICKET_RE=/^[A-Za-z0-9_-]{43}$/; // 256-bit random ticket
const isRecord=(v:unknown):v is Record<string,unknown> =>
  v!==null && typeof v==="object" && !Array.isArray(v);
const isExact=(v:unknown,keys:readonly string[]):v is Record<string,unknown> =>
  isRecord(v) && Object.keys(v).length===keys.length &&
  Object.keys(v).every(k=>keys.includes(k));
/** Native CustomTabsSession.postMessage and onPostMessage transport text JSON. */
function parseSmallNativeJson(raw:unknown):unknown {
  if(typeof raw!=="string" || raw.length===0 || raw.length>512) return null;
  try {return JSON.parse(raw) as unknown;}
  catch {return null;}
}

/** Pure holder of an origin-checked port; sends no ticket until READY. */
export class TwaWebCheckoutChannel {
  private phase:"waiting_ready"|"ready"|"sent"|"closed"="waiting_ready";
  private readonly port:PortLike;
  private readonly nonce:string;
  constructor(port:PortLike,nonce:string) {
    this.port=port;
    this.nonce=nonce;
  }

  get ready():boolean {return this.phase==="ready";}

  acceptReady(message:unknown):boolean {
    const parsed=parseSmallNativeJson(message);
    if(this.phase!=="waiting_ready" ||
       !isExact(parsed,["type","nonce"]) ||
       parsed.type!==TWA_PLAY_PROTOCOL+"/ready" ||
       parsed.nonce!==this.nonce) return false;
    this.phase="ready";
    return true;
  }

  /**
   * Only call after the user actively selects checkout and an authenticated
   * server POST returns the ticket. The caller must not log or persist it.
   */
  sendTicket(ticket:string,expiresAtMillis:number,now:Date=new Date()):boolean {
    const remaining=expiresAtMillis-now.getTime();
    if(this.phase!=="ready" || !TICKET_RE.test(ticket) ||
       !Number.isFinite(now.getTime()) || !Number.isSafeInteger(expiresAtMillis) ||
       remaining<=0 || remaining>120_000) return false;
    // Lock the channel before posting to prevent replay even if send throws.
    this.phase="sent";
    const packet:Ticket={
      type:"signalx.play.bridge.v1/checkout-ticket",
      nonce:this.nonce,ticket,expiresAtMillis
    };
    try {this.port.postMessage(JSON.stringify(packet));return true;}
    catch {this.close();return false;}
  }

  close():void {
    this.phase="closed";
    try {this.port.close?.();} catch {/* no secret-bearing diagnostics */}
  }
}

export function acceptTwaNativeHello(
  event:EventLike,expectedOrigin:string=TWA_PLAY_ORIGIN
):BridgeAccept {
  const incoming=parseSmallNativeJson(event?.data);
  if(expectedOrigin!==TWA_PLAY_ORIGIN || !event ||
     event.origin!==TWA_PLAY_ORIGIN || !Array.isArray(event.ports) ||
     event.ports.length!==1 || !event.ports[0] ||
     typeof event.ports[0].postMessage!=="function" ||
     !isExact(incoming,["type","nonce"]) ||
     incoming.type!==TWA_PLAY_PROTOCOL+"/hello" ||
     typeof incoming.nonce!=="string" ||
     !NONCE_RE.test(incoming.nonce)) return {kind:"rejected"};
  const nonce=incoming.nonce;
  return {
    kind:"accepted",
    channel:new TwaWebCheckoutChannel(event.ports[0],nonce),
    ackJson:JSON.stringify({type:"signalx.play.bridge.v1/hello-ack",nonce} satisfies Ack)
  };
}
