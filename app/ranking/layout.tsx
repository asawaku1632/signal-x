import type { ReactNode } from "react";

export default function RankingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ranking-compact">
      {children}
      <style>{`
        /* Ranking cards: keep all information while reducing vertical scrolling. */
        .ranking-compact article {
          padding: 12px !important;
          border-radius: 18px !important;
        }

        .ranking-compact article > div:first-child[class*="mb-3"] {
          margin-bottom: 8px !important;
          padding-top: 5px !important;
          padding-bottom: 5px !important;
          border-radius: 12px !important;
        }

        .ranking-compact article > div[class*="flex"][class*="items-start"] {
          gap: 8px !important;
        }

        .ranking-compact article h2 {
          font-size: 1.2rem !important;
          line-height: 1.45rem !important;
        }

        .ranking-compact article h2 + span {
          padding: 2px 7px !important;
          font-size: 10px !important;
        }

        .ranking-compact article p[class*="text-lg"] {
          font-size: .95rem !important;
          line-height: 1.25rem !important;
        }

        .ranking-compact article p[class*="text-3xl"] {
          font-size: 1.7rem !important;
          line-height: 1.8rem !important;
        }

        /* AI detected pattern panel */
        .ranking-compact article section[aria-label^="AI検出パターン"],
        .ranking-compact section.border-yellow-200 section[aria-label^="AI検出パターン"] {
          margin-top: 8px !important;
          padding: 8px 10px !important;
          border-radius: 14px !important;
        }

        .ranking-compact section[aria-label^="AI検出パターン"] > div {
          margin-top: 4px !important;
        }

        .ranking-compact section[aria-label^="AI検出パターン"] a {
          min-height: 32px !important;
          padding: 4px 10px !important;
        }

        /* Metric tiles: 3 columns instead of large 2-column blocks. */
        .ranking-compact article > div.grid.grid-cols-2,
        .ranking-compact section.border-yellow-200 > div.grid.grid-cols-2:first-of-type {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 6px !important;
          margin-top: 8px !important;
        }

        .ranking-compact article > div.grid > div,
        .ranking-compact section.border-yellow-200 > div.grid > div {
          padding: 7px 3px !important;
          border-radius: 12px !important;
          min-height: 54px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ranking-compact article > div.grid > div p:first-child,
        .ranking-compact section.border-yellow-200 > div.grid > div p:first-child {
          font-size: 9px !important;
          line-height: 12px !important;
        }

        .ranking-compact article > div.grid > div p:last-child,
        .ranking-compact section.border-yellow-200 > div.grid > div p:last-child {
          margin-top: 2px !important;
          font-size: 12px !important;
          line-height: 16px !important;
        }

        .ranking-compact article > div.grid.grid-cols-3 {
          margin-top: 6px !important;
          gap: 6px !important;
        }

        /* Action buttons stay easy to tap, but lose unnecessary height. */
        .ranking-compact article > div.grid:last-child,
        .ranking-compact section.border-yellow-200 > div.grid:last-child {
          margin-top: 8px !important;
          gap: 6px !important;
        }

        .ranking-compact article > div.grid:last-child a,
        .ranking-compact section.border-yellow-200 > div.grid:last-child a {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
          border-radius: 13px !important;
        }

        /* The special '本日の最有力' card uses the same compact density. */
        .ranking-compact section.border-yellow-200 {
          padding: 12px !important;
          border-radius: 18px !important;
        }

        .ranking-compact section.border-yellow-200 > div[class*="items-start"] {
          margin-top: 8px !important;
        }

        .ranking-compact section.border-yellow-200 p[class*="text-4xl"] {
          font-size: 1.9rem !important;
          line-height: 2rem !important;
        }

        .ranking-compact section.border-yellow-200 p[class*="text-2xl"] {
          font-size: 1.25rem !important;
          line-height: 1.5rem !important;
        }

        .ranking-compact section.border-yellow-200 p[class*="text-5xl"] {
          font-size: 2.3rem !important;
          line-height: 2.4rem !important;
        }

        @media (max-width: 359px) {
          .ranking-compact article > div.grid.grid-cols-2,
          .ranking-compact section.border-yellow-200 > div.grid.grid-cols-2:first-of-type {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
