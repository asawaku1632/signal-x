/** Research-only evidence from 48 manually submitted Preview batch responses (2026-10-17).
 * No provider re-fetch, database writes, cron, notifications or production changes.
 * A 404 is a provider response, NOT proof of delisting.
 * "succeeded" means >=110 historical observations for the probe, NOT trading accuracy.
 * Prior BB_VENDOR_PROBE_500_V1 recorded 18 HTTP404; this 950 run observed
 * two additional HTTP404 in the unchanged first-500 roster: 1973 and 2427.
 * These discrepancies require re-probing; do not silently replace old evidence.
 */
export const BB_VENDOR_950_BATCH_EVIDENCE = {
  "0": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "1": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "2": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "3": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "4": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "5": {
    "requested": 20,
    "succeeded": 17,
    "http404": [
      "9613",
      "2412",
      "4384"
    ],
    "insufficientHistory": []
  },
  "6": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "3141"
    ],
    "insufficientHistory": []
  },
  "7": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "8": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "1809"
    ],
    "insufficientHistory": []
  },
  "9": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "2651"
    ],
    "insufficientHistory": []
  },
  "10": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "1949"
    ],
    "insufficientHistory": []
  },
  "11": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "12": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "6028",
      "6201"
    ],
    "insufficientHistory": []
  },
  "13": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "14": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "9719"
    ],
    "insufficientHistory": []
  },
  "15": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "9783",
      "1821"
    ],
    "insufficientHistory": []
  },
  "16": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "1973",
      "2427"
    ],
    "insufficientHistory": []
  },
  "17": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "18": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "4453"
    ],
    "insufficientHistory": []
  },
  "19": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "4974",
      "5486"
    ],
    "insufficientHistory": []
  },
  "20": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "21": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "7518"
    ],
    "insufficientHistory": []
  },
  "22": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "8279"
    ],
    "insufficientHistory": []
  },
  "23": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "24": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "9749"
    ],
    "insufficientHistory": []
  },
  "25": {
    "requested": 20,
    "succeeded": 17,
    "http404": [
      "1712",
      "1726",
      "1805"
    ],
    "insufficientHistory": []
  },
  "26": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "27": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "2453"
    ],
    "insufficientHistory": []
  },
  "28": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "29": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "30": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "3319"
    ],
    "insufficientHistory": [
      "3480"
    ]
  },
  "31": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "3655"
    ],
    "insufficientHistory": []
  },
  "32": {
    "requested": 20,
    "succeeded": 17,
    "http404": [
      "3681",
      "3688",
      "3902"
    ],
    "insufficientHistory": []
  },
  "33": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "3978"
    ],
    "insufficientHistory": []
  },
  "34": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "35": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "4348"
    ],
    "insufficientHistory": []
  },
  "36": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "4530"
    ],
    "insufficientHistory": []
  },
  "37": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "4739"
    ],
    "insufficientHistory": []
  },
  "38": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "5017",
      "5191"
    ],
    "insufficientHistory": []
  },
  "39": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "5727",
      "5809"
    ],
    "insufficientHistory": []
  },
  "40": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "6095"
    ],
    "insufficientHistory": []
  },
  "41": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "6197"
    ],
    "insufficientHistory": []
  },
  "42": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "43": {
    "requested": 20,
    "succeeded": 20,
    "http404": [],
    "insufficientHistory": []
  },
  "44": {
    "requested": 20,
    "succeeded": 18,
    "http404": [
      "6670",
      "6755"
    ],
    "insufficientHistory": []
  },
  "45": {
    "requested": 20,
    "succeeded": 19,
    "http404": [
      "6967"
    ],
    "insufficientHistory": []
  },
  "46": {
    "requested": 20,
    "succeeded": 17,
    "http404": [
      "7088",
      "7092",
      "7105"
    ],
    "insufficientHistory": []
  },
  "47": {
    "requested": 10,
    "succeeded": 9,
    "http404": [
      "7250"
    ],
    "insufficientHistory": []
  }
} as const;

export const BB_VENDOR_950_SUMMARY = {
  universeVersion: "BB_VENDOR_PROBE_950_V1",
  source: "OWNER_PREVIEW_READ_ONLY_MANUAL_48_BATCH_RESULTS",
  requested: 950,
  succeeded: 903,
  providerHttp404: 46,
  insufficientPriceHistory: 1,
  failed: 47,
  listingStatus: "UNVERIFIED",
  historicFirst500Discrepancies: ["1973", "2427"],
  automaticDailyOperationValidated: false,
  productionChanged: false,
} as const;

export function verifyBbVendor950Evidence(): boolean {
  const batches = Object.values(BB_VENDOR_950_BATCH_EVIDENCE);
  const totals = batches.reduce((acc, batch) => {
    acc.requested += batch.requested;
    acc.succeeded += batch.succeeded;
    acc.http404 += batch.http404.length;
    acc.insufficient += batch.insufficientHistory.length;
    return acc;
  }, { requested: 0, succeeded: 0, http404: 0, insufficient: 0 });
  const allErrors = batches.flatMap(b => [...b.http404, ...b.insufficientHistory]);
  return batches.length === 48
    && batches.slice(0,47).every(b => b.requested === 20)
    && batches[47].requested === 10
    && batches.every(b => b.succeeded + b.http404.length + b.insufficientHistory.length === b.requested)
    && new Set(allErrors).size === allErrors.length
    && totals.requested === BB_VENDOR_950_SUMMARY.requested
    && totals.succeeded === BB_VENDOR_950_SUMMARY.succeeded
    && totals.http404 === BB_VENDOR_950_SUMMARY.providerHttp404
    && totals.insufficient === BB_VENDOR_950_SUMMARY.insufficientPriceHistory;
}
