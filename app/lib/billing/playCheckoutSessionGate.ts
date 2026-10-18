/**
 * RESEARCH-ONLY Web checkout issue boundary. Not an API route, not wired to UI.
 *
 * Session MUST be resolved by the server using getServerSession(authOptions).
 * Never call with a client-built session object in production. Google OAuth
 * resolves a stable signalxUserId -> session.user.id; the Play review
 * credentials session has no signalxUserId and must fail closed.
 *
 * This helper validates a strict same-origin browser POST with no caller-supplied
 * identity, SKU, amount, callback URL or redirect. Caller MUST return no-store,
 * avoid logging raw ticket, and keep the feature disabled until a verified
 * Android TWA postMessage bridge and actual Play Integrity are present.
 */
import type { Pool } from "pg";
import {
  issuePlayCheckoutTicketResearch,
  type CheckoutIssueResult,
} from "./playCheckoutTicketResearch.ts";

type DB = Pick<Pool, "query">;
type TicketConfig = Parameters<typeof issuePlayCheckoutTicketResearch>[1];
type Session = { user?: { id?: unknown } } | null;
type TrustedSessionResolver = () => Promise<Session>;
type IssueGateResult =
  | CheckoutIssueResult
  | {kind:"disabled"|"request_rejected"|"unauthenticated"};

const SIGNALX_ORIGIN = "https://signal-x-ppjg.vercel.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function readTinyJsonBody(request:Request):Promise<string|null>{
  // Enforce the limit while streaming, not after collecting attacker input.
  const declared=request.headers.get("content-length");
  if(declared!==null && (!/^[0-9]+$/.test(declared) || Number(declared)>256))
    return null;
  if(!request.body) return null;
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try {
    for (;;) {
      const part=await reader.read();
      if(part.done) break;
      total+=part.value.byteLength;
      if(total>256){
        await reader.cancel().catch(()=>undefined);
        return null;
      }
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  } catch{return null;}
  finally {reader.releaseLock();}
}

export async function issueAuthenticatedPlayCheckoutResearch(
  request: Request,
  options:{
    enabled: boolean;
    expectedOrigin: string;
    ticket: TicketConfig;
  },
  database: DB,
  trustedGetServerSession: TrustedSessionResolver,
  now: Date=new Date(),
): Promise<IssueGateResult> {
  if(options?.enabled !== true) return {kind:"disabled"};
  if(!request || typeof trustedGetServerSession !== "function" ||
     !Number.isFinite(now.getTime()) ||
     options.expectedOrigin !== SIGNALX_ORIGIN) return {kind:"request_rejected"};

  let url: URL;
  try { url=new URL(request.url); }
  catch {return {kind:"request_rejected"};}
  if(
    request.method!=="POST" || url.origin!==SIGNALX_ORIGIN ||
    url.search!=="" || url.hash!=="" ||
    request.headers.get("host")!==url.host ||
    request.headers.get("origin")!==SIGNALX_ORIGIN ||
    request.headers.get("sec-fetch-site")!=="same-origin" ||
    request.headers.get("x-signalx-request")!=="play-checkout-issue-v1" ||
    request.headers.get("authorization")!==null ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get("content-type")??""
    )
  ) return {kind:"request_rejected"};

  const body=await readTinyJsonBody(request);
  if(body===null) return {kind:"request_rejected"};
  // No client-chosen user ID, product, plan, amount, ticket or redirect.
  // A valid checkout request has exactly an empty JSON object as its body.
  try {
    const parsed:unknown=JSON.parse(body);
    if(!parsed || typeof parsed!=="object" || Array.isArray(parsed) ||
       Object.keys(parsed).length!==0)
      return {kind:"request_rejected"};
  } catch {return {kind:"request_rejected"};}

  let session:Session;
  try { session=await trustedGetServerSession(); }
  catch {return {kind:"unauthenticated"};}
  const id=session?.user?.id;
  if(typeof id!=="string" || !UUID.test(id))
    return {kind:"unauthenticated"};

  // Issue function rechecks the DB account is enabled at insertion time.
  return issuePlayCheckoutTicketResearch(id,options.ticket,database,now);
}
