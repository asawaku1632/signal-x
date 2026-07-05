import { calculateMarketLearningBonus } from "./marketLearning";
import { getLearningVolatilityBonus } from "./volatilityLearning";
import { getLearningEventBonus } from "./eventLearning";
import { getLearningRiskBonus } from "./riskLearning";

export async function getLearningResult({
  marketPattern,
  fixedMarketBonus,
  latestMarketBonus,
  timeLearning,
  volatility,
  eventKey,
  eventBonus,
  riskKey,
  riskBonus,
}:{
  marketPattern:string;
  fixedMarketBonus:number;
  latestMarketBonus:{bonus:number;winRate:number;confidence:number};
  timeLearning:any;
  volatility:number;
  eventKey:string;
  eventBonus:number;
  riskKey:string;
  riskBonus:number;
}){
  const market=calculateMarketLearningBonus({
    marketPattern,
    fixedBonus:fixedMarketBonus,
    latestMarketBonus,
  });

  const volatilityLearning=await getLearningVolatilityBonus(volatility);

  const event=getLearningEventBonus({
    eventKey,
    eventBonus,
    eventStatsMap:{},
  });

  const risk=getLearningRiskBonus({
    riskKey,
    riskBonus,
    riskStatsMap:{},
  });

  return{
    market,
    time:timeLearning,
    volatility:volatilityLearning,
    event,
    risk,
  };
}

export function getStockLearningContext(){
  return {};
}
