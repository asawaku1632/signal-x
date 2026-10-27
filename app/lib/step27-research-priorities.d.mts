export declare function prioritizeMarketIndexResearch(nextStep: { state: string } | null): {
  status: "RESEARCH_ONLY";
  recommendedFirst: string;
  tasks: Array<{ id: string; priority: number; title: string; action: string; status: string }>;
  note: string;
};
