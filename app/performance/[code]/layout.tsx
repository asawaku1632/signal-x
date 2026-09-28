import type { ReactNode } from "react";

import CapitalSimulationCard from "./CapitalSimulationCard";

export default async function PerformanceStockLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <>
      {children}
      <div className="mx-auto max-w-md bg-[#f7f9fc] px-4 pb-24">
        <CapitalSimulationCard code={code} />
      </div>
    </>
  );
}
