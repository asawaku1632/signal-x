import "server-only";
import {Pool} from "pg";
import {checkBbExpansionDbSafety} from "./bollingerExpansionDbSafety.mjs";

/** Independent research connection. Never falls back to the shared DATABASE_URL.
 * Research runner is gated by the offline safety preflight.
 */
export function createBbExpansionResearchPool(environment:NodeJS.ProcessEnv=process.env){
 const check=checkBbExpansionDbSafety(environment);
 if(!check.ok)throw Error(check.reason);
 const connectionString=environment.BB_EXPANSION_RESEARCH_DATABASE_URL;
 if(!connectionString)throw Error("RESEARCH_DB_UNCONFIRMED");
 return new Pool({connectionString,ssl:{rejectUnauthorized:true},max:2});
}
