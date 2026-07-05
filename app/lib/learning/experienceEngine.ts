export type ExperienceResult = {
  experience:{bonus:number};
  similarExperience:{bonus:number};
  experienceRanking:{bonus:number};
};

export function getExperienceResult({
  experienceKey,
  experienceBonusMap,
  similarExperienceBonusMap,
  experienceRankingMap,
}:{
  experienceKey:string;
  experienceBonusMap:Map<string,any>;
  similarExperienceBonusMap:Map<string,any>;
  experienceRankingMap:Map<string,any>;
}):ExperienceResult{
  const exp=experienceBonusMap.get(experienceKey);
  const sim=similarExperienceBonusMap.get(experienceKey);
  const rank=experienceRankingMap.get(experienceKey);

  return{
    experience:{bonus:exp?.bonus??0},
    similarExperience:{bonus:sim?.bonus??0},
    experienceRanking:{bonus:rank?.bonus??0},
  };
}

export function getExperienceLearningMaps(){
  return {};
}
