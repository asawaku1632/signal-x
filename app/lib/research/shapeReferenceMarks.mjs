export function shapeDirectionGuide(direction){
 if(direction==="BUY")return {label:"買い目線（上昇型）",short:"買い目線",description:"上昇や反発を探す形です。今回の日足でも条件が一致するか確認しましょう。",classes:"border-emerald-300 bg-emerald-50 text-emerald-950",badge:"bg-emerald-100 text-emerald-800"};
 if(direction==="SELL")return {label:"売り警戒（下落型）",short:"売り警戒",description:"下落や反落に注意する形です。保有中なら支持線や形の崩れを確認する目安です。",classes:"border-rose-300 bg-rose-50 text-rose-950",badge:"bg-rose-100 text-rose-800"};
 return {label:"待ち（方向待ち）",short:"方向待ち",description:"まだ上か下かが決まっていない形です。どちらへ動き出すかを待つ分類です。",classes:"border-amber-300 bg-amber-50 text-amber-950",badge:"bg-amber-100 text-amber-900"};
}
/** Re-evaluate each prefix only. Mark confirmation onset, not an invented geometric pivot. */
export function shapeConditionMarks(candles,matchesAtEnd){
 let start=-1,end=-1,prior=false;
 for(let i=4;i<candles.length;i++){
  const matched=Boolean(matchesAtEnd(candles.slice(0,i+1)));
  if(matched){
   if(!prior)start=i;
   end=i;
  }
  prior=matched;
 }
 if(start<0)return {marks:[],active:false,historyLimited:false};
 const marks=[{index:start,time:candles[start].time,label:start===end?"① 一致足":"① 一致開始",kind:"start"}];
 if(end!==start)marks.push({index:end,time:candles[end].time,label:end===candles.length-1?"② 判定足":"② 最終一致",kind:"end"});
 return {marks,active:end===candles.length-1,historyLimited:start===4};
}
