"use server";

import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { dateJst, fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import { SWING_SHADOW_VERSION, studyMsbMaSwing } from "@/app/lib/research/msbMaSwing";
import { VOLUME_SENSITIVITY_VERSION, historicalVolumeRatio } from "@/app/lib/research/msbMaVolumeSensitivity";

/**
 * Explicit owner-only POST. Re-fetch up to 5 confirmed Yahoo 1D datasets once;
 * never trust stats, candle values, volume ratios, or success claims from HTML.
 * Writes only dedicated append-only MSB research tables.
 */
export async function saveMsbVolumeResearch(form: FormData): Promise<void> {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const raw = form.get("codes");
  if (typeof raw !== "string" || raw.length > 80) {
    redirect("/admin/shadow-msb-ob-swing?save=invalid");
  }
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  if (!codes.length || codes.length > 5 || new Set(codes).size !== codes.length ||
      codes.some(code => !/^[0-9]{4}$/.test(code))) {
    redirect("/admin/shadow-msb-ob-swing?save=invalid");
  }

  const loaded = await fetchCohort(codes);
  if (loaded.length !== codes.length || loaded.some(row => row.error || row.candles.length < 60)) {
    redirect("/admin/shadow-msb-ob-swing?save=unavailable");
  }
  const stocks = loaded.map(({code,candles})=>({code,candles}));
  const report = studyMsbMaSwing(stocks);
  if (report.invalidCodes.length || report.cohortCount !== codes.length) {
    redirect("/admin/shadow-msb-ob-swing?save=unavailable");
  }

  // Detector and output based ONLY on server-fetched, completed, immutable bar snapshots.
  const fingerprint=stocks.map(({code,candles})=>({
    code, bars:candles.map(c=>[c.time,c.open,c.high,c.low,c.close,c.volume??null]),
  })).sort((a,b)=>a.code.localeCompare(b.code));
  const inputHash=createHash("sha256").update(JSON.stringify({
    detector:SWING_SHADOW_VERSION, volume:VOLUME_SENSITIVITY_VERSION, stocks:fingerprint,
  })).digest("hex");

  const first=Math.min(...stocks.flatMap(s=>s.candles.map(c=>c.time)));
  const last=Math.max(...stocks.flatMap(s=>s.candles.map(c=>c.time)));
  const byCode=new Map(stocks.map(s=>[s.code,s.candles]));
  const trades=report.trades.map(trade=>{
    const candles=byCode.get(trade.code)!;
    return {
      ...trade,
      breakoutRatio:trade.orderBlock?historicalVolumeRatio(candles,trade.orderBlock.breakIndex):null,
      retestRatio:trade.orderBlock?historicalVolumeRatio(candles,trade.signalIndex):null,
    };
  });
  let saved=false;
  let client;
  try {
    client=await pool.connect();
    await client.query("BEGIN");
    const result=await client.query<{id:string}>(
      "INSERT INTO public.msb_volume_research_runs "+
      "(detector_version,volume_version,input_hash,codes,first_bar_date,last_bar_date,base_count,ob_count) "+
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(input_hash) DO NOTHING RETURNING id::text",
      [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION,inputHash,[...codes].sort(),
       dateJst(first),dateJst(last),trades.length,trades.filter(t=>t.orderBlock).length],
    );
    const runId=result.rows[0]?.id;
    if(runId) {
      saved=true;
      if(trades.length) {
        await client.query(
          "INSERT INTO public.msb_volume_research_observations "+
          "(detector_version,volume_version,code,signal_time,entry_time,exit_time,"+
          "profit_yen_100,return_percent,volume_eligible,ob_eligible,breakout_ratio,retest_ratio,first_run_id) "+
          "SELECT $1,$2,x.code,x.signal_time,x.entry_time,x.exit_time,x.profit,x.ret,x.vol,x.ob,"+
          "x.breakout,x.retest,$3::uuid FROM "+
          "UNNEST($4::text[],$5::bigint[],$6::bigint[],$7::bigint[],$8::integer[],$9::numeric[],"+
          "$10::boolean[],$11::boolean[],$12::numeric[],$13::numeric[]) "+
          "AS x(code,signal_time,entry_time,exit_time,profit,ret,vol,ob,breakout,retest) "+
          "ON CONFLICT(detector_version,volume_version,code,signal_time) DO NOTHING",
          [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION,runId,
           trades.map(t=>t.code),trades.map(t=>t.signalTime),
           trades.map(t=>t.entryTime),trades.map(t=>t.exitTime),
           trades.map(t=>t.profitYen100),trades.map(t=>t.returnPercent),
           trades.map(t=>t.eligible.MA525_VOLUME),trades.map(t=>t.orderBlock!==null),
           trades.map(t=>t.breakoutRatio),trades.map(t=>t.retestRatio)],
        );
      }
    }
    await client.query("COMMIT");
  } catch(error) {
    if(client) await client.query("ROLLBACK").catch(()=>undefined);
    console.error("owner-only msb shadow archive save failed",error);
    redirect("/admin/shadow-msb-ob-swing?save=error");
  } finally {
    client?.release();
  }
  redirect("/admin/shadow-msb-ob-swing/archive?save="+(saved?"saved":"duplicate"));
}
