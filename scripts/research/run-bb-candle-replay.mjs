#!/usr/bin/env node
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
export function run(args){
  const detailed=args[0]==="--details";
  const paths=detailed?args.slice(1):args;
  if(paths.includes("--details")||paths.length<1||paths.length>30)throw Error("USAGE_1_TO_30_ARCHIVE_FILES");
  const archives=paths.map(path=>{
    if(statSync(path).size>8_000_000)throw Error("ARCHIVE_TOO_LARGE");
    return JSON.parse(readFileSync(path,"utf8"));
  });
  return replayBbCandleArchives(archives,{exploratoryDetails:detailed});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}
  catch(e){console.error("BB_CANDLE_REPLAY_BLOCKED",/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_CAPTURE");process.exitCode=1;}
}
