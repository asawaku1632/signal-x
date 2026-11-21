#!/usr/bin/env node
/** Offline only: local private J-Quants archives and separately provided daily
 * benchmark CLOSE JSON. Never fetches or writes anything. */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
import {compareBuyEventsByMarketRegime} from "../../app/lib/research/bbMarketRegimeV1.mjs";
const load=(path,max)=>{
 if(!path||statSync(path).size>max)throw Error("INVALID_INPUT_SIZE");
 return JSON.parse(readFileSync(path,"utf8"));
};
export function run(paths){
 if(paths.length<2||paths.length>31)throw Error("USAGE_BENCHMARK_THEN_1_TO_30_ARCHIVES");
 const [indexFile,...files]=paths;
 const index=load(indexFile,250000);
 if(index?.benchmark!=="TOPIX"&&index?.benchmark!=="NIKKEI225")
   throw Error("BENCHMARK_ID_REQUIRED");
 const captures=files.map(path=>load(path,8000000));
 const replay=replayBbCandleArchives(captures,{exploratoryDetails:true});
 const market=compareBuyEventsByMarketRegime(replay.exploratoryBuyEvents,index.closes);
 return {status:"OFFLINE_MARKET_REGIME_SHADOW_ONLY",benchmark:index.benchmark,
   stockCount:replay.stockCount,tradingDates:replay.tradingDates,uniqueBuyEvents:replay.exploratoryBuyEvents.length,
   market:market.summary,events:market.rows,eligibleForProduction:false,
   eligibleForNotifications:false,actualIntradayMarketAvailabilityVerified:false,
   note:"Benchmark dates must be complete and contiguous. Results are historical descriptions, not proof of profitable trading."};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}
 catch(e){console.error("BB_MARKET_REGIME_BLOCKED",
   /^[A-Z_0-9]+$/.test(e?.message) ? e.message : "INVALID_PRIVATE_INPUT");process.exitCode=1;}
}
