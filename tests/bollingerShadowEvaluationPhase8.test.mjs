import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASE_8_COHORT_DEFINITION_VERSION,
  PHASE_8_EVALUATION_VERSION,
  PHASE_8_HORIZONS,
  canonicalPhase8Json,
  evaluateBollingerShadow,
} from "../app/lib/technicalObservation/bollingerShadowEvaluation.ts";

const versions = {
  evaluationVersion: PHASE_8_EVALUATION_VERSION,
  cohortDefinitionVersion: PHASE_8_COHORT_DEFINITION_VERSION,
  detectorVersion: "BB_OBSERVATION_V1",
  resultVersion: "BB_OBSERVATION_RESULT_V1",
  calendarVersion: "TEST_CALENDAR_V1",
};

function result(horizon, returnPercent, overrides = {}) {
  const dates = { 1: "2026-01-02", 3: "2026-01-06", 5: "2026-01-08" };
  return {
    horizon,
    returnPercent,
    maxRisePercent: returnPercent + 2,
    maxDrawdownPercent: returnPercent - 2,
    expectedTradeDate: dates[horizon],
    evaluatedTradeDate: dates[horizon],
    resultVersion: versions.resultVersion,
    calendarVersion: versions.calendarVersion,
    ...overrides,
  };
}

function event(index, overrides = {}) {
  const returnPercent = (index % 3) - 1;
  return {
    eventId: index + 1,
    snapshotId: index + 100,
    code: String(1000 + (index % 5)),
    observationDate: "2026-01-01",
    side: index % 2 ? "UPPER" : "LOWER",
    sigmaLevel: index % 2 ? 3 : 2,
    eventType: ["TOUCH", "CROSS", "CONTINUATION", "RETURN_INSIDE"][index % 4],
    detectorVersion: versions.detectorVersion,
    results: [result(1, returnPercent), result(3, returnPercent), result(5, returnPercent)],
    ...overrides,
  };
}

function input(events, overrides = {}) {
  return {
    sourceCutoff: "2026-01-31T00:00:00Z",
    ...versions,
    minimumSampleThreshold: 30,
    readOnly: true,
    events,
    ...overrides,
  };
}

function all(output) {
  return output.cohorts.find((cohort) => cohort.key === "ALL");
}

function horizon(output, value) {
  return all(output).horizons.find((item) => item.horizon === value);
}

test("zero samples retain counts and suppress distribution metrics", () => {
  const output = evaluateBollingerShadow(input([]));
  assert.equal(output.status, "INSUFFICIENT_SAMPLE");
  assert.deepEqual({ sample: output.metadata.sampleCount, complete: output.metadata.completeSampleCount,
    incomplete: output.metadata.incompleteSampleCount }, { sample: 0, complete: 0, incomplete: 0 });
  assert.equal(horizon(output, 1).metrics, null);
});

test("fewer than 30 complete samples are insufficient and exactly 30 expose metrics", () => {
  const small = evaluateBollingerShadow(input(Array.from({ length: 29 }, (_, index) => event(index))));
  assert.equal(small.status, "INSUFFICIENT_SAMPLE");
  assert.equal(horizon(small, 1).completeCount, 29);
  assert.equal(horizon(small, 1).metrics, null);

  const allowed = evaluateBollingerShadow(input(Array.from({ length: 30 }, (_, index) => event(index))));
  assert.equal(allowed.status, "COMPLETE");
  assert.equal(horizon(allowed, 1).completeCount, 30);
  assert.notEqual(horizon(allowed, 1).metrics, null);
});

test("exactly 100 complete samples expose the full approved descriptive distribution", () => {
  const output = evaluateBollingerShadow(input(Array.from({ length: 100 }, (_, index) => event(index))));
  const metrics = horizon(output, 5).metrics;
  assert.equal(output.status, "COMPLETE");
  for (const key of ["populationStandardDeviation", "p10", "p25", "p75", "p90"])
    assert.equal(Number.isFinite(metrics[key]), true);
  assert.equal(output.metadata.fullDistributionThreshold, 100);
});

test("missing horizons remain explicit without invalidating completed earlier horizons", () => {
  const events = Array.from({ length: 33 }, (_, index) => event(index, { results:
    [result(1, 1), result(3, 2), result(5, 3)].filter((item) => item.horizon !== index + 1) }));
  const output = evaluateBollingerShadow(input(events));
  assert.equal(output.status, "INCOMPLETE_DATA");
  for (const value of [1, 3, 5]) {
    assert.deepEqual({ status: horizon(output, value).status, complete: horizon(output, value).completeCount,
      incomplete: horizon(output, value).incompleteCount },
    { status: "INCOMPLETE_DATA", complete: 32, incomplete: 1 });
    assert.notEqual(horizon(output, value).metrics, null);
  }
  assert.equal(all(output).fullLifecycleCompleteCount, 30);
});

test("raw positive negative and zero ratios are deterministic", () => {
  const events = Array.from({ length: 30 }, (_, index) => event(index, { results: [
    result(1, (index % 3) - 1), result(3, 1), result(5, 1),
  ] }));
  const metrics = horizon(evaluateBollingerShadow(input(events)), 1).metrics;
  assert.equal(metrics.positiveReturnRatio, 1 / 3);
  assert.equal(metrics.negativeReturnRatio, 1 / 3);
  assert.equal(metrics.zeroReturnRatio, 1 / 3);
  assert.equal(metrics.meanReturn, 0);
});

test("median handles odd and even sample counts without intermediate rounding", () => {
  const odd = Array.from({ length: 31 }, (_, index) => event(index,
    { results: [result(1, index), result(3, index), result(5, index)] }));
  const even = Array.from({ length: 30 }, (_, index) => event(index,
    { results: [result(1, index), result(3, index), result(5, index)] }));
  assert.equal(horizon(evaluateBollingerShadow(input(odd)), 1).metrics.medianReturn, 15);
  assert.equal(horizon(evaluateBollingerShadow(input(even)), 1).metrics.medianReturn, 14.5);
});

test("max rise and max drawdown aggregate as raw observations", () => {
  const events = Array.from({ length: 30 }, (_, index) => event(index, { results: [
    result(1, 0, { maxRisePercent: index, maxDrawdownPercent: -index }),
    result(3, 0), result(5, 0),
  ] }));
  const metrics = horizon(evaluateBollingerShadow(input(events)), 1).metrics;
  assert.equal(metrics.meanMaxRise, 14.5);
  assert.equal(metrics.medianMaxRise, 14.5);
  assert.equal(metrics.meanMaxDrawdown, -14.5);
  assert.equal(metrics.medianMaxDrawdown, -14.5);
});

test("LOWER and UPPER cohorts preserve the same raw return sign", () => {
  for (const side of ["LOWER", "UPPER"]) {
    const events = Array.from({ length: 30 }, (_, index) => event(index, { side, results: [
      result(1, -2), result(3, -2), result(5, -2),
    ] }));
    const output = evaluateBollingerShadow(input(events));
    const cohort = output.cohorts.find((item) => item.key === `SIDE:${side}`);
    assert.equal(cohort.horizons[0].metrics.meanReturn, -2);
    assert.equal(cohort.horizons[0].metrics.negativeReturnRatio, 1);
  }
});

test("multiple events may share a snapshot while correlation counts remain visible", () => {
  const events = [event(0, { snapshotId: 500, code: "7203", observationDate: "2026-01-01" }),
    event(1, { snapshotId: 500, code: "7203", observationDate: "2026-01-01" })];
  const output = evaluateBollingerShadow(input(events));
  assert.deepEqual({ sample: output.metadata.sampleCount, snapshots: output.metadata.uniqueSnapshotCount,
    symbols: output.metadata.uniqueSymbolCount, dates: output.metadata.uniqueObservationDateCount },
  { sample: 2, snapshots: 1, symbols: 1, dates: 1 });
});

test("primary cohorts have fixed ordering and exact definitions", () => {
  const output = evaluateBollingerShadow(input([event(0, { side: "LOWER", sigmaLevel: 2,
    eventType: "TOUCH" })]));
  assert.deepEqual(output.cohorts.map((cohort) => cohort.key), [
    "ALL", "SIDE:LOWER", "SIDE:UPPER", "SIGMA:2", "SIGMA:3",
    "EVENT_TYPE:TOUCH", "EVENT_TYPE:CROSS", "EVENT_TYPE:CONTINUATION",
    "EVENT_TYPE:RETURN_INSIDE", "SIDE_X_SIGMA:LOWER:2", "SIDE_X_SIGMA:LOWER:3",
    "SIDE_X_SIGMA:UPPER:2", "SIDE_X_SIGMA:UPPER:3",
  ]);
  for (const key of ["SIDE:LOWER", "SIGMA:2", "EVENT_TYPE:TOUCH", "SIDE_X_SIGMA:LOWER:2"])
    assert.equal(output.cohorts.find((cohort) => cohort.key === key).sampleCount, 1);
});

test("invalid NaN Infinity and duplicate horizons fail closed", () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const output = evaluateBollingerShadow(input([event(0, { results: [
      result(1, invalid), result(3, 0), result(5, 0),
    ] })]));
    assert.equal(output.status, "INVALID_DATA");
    assert.equal(output.cohorts.length, 0);
  }
  assert.equal(evaluateBollingerShadow(input([event(0, { results: [result(1, 0), result(1, 0)] })])).status,
    "INVALID_DATA");
});

test("version and calendar mismatches fail closed", () => {
  assert.equal(evaluateBollingerShadow(input([event(0, { detectorVersion: "OTHER" })])).status,
    "VERSION_MISMATCH");
  assert.equal(evaluateBollingerShadow(input([event(0, { results: [
    result(1, 0, { resultVersion: "OTHER" }), result(3, 0), result(5, 0),
  ] })])).status, "VERSION_MISMATCH");
  assert.equal(evaluateBollingerShadow(input([event(0, { results: [
    result(1, 0, { evaluatedTradeDate: "2026-01-03" }), result(3, 0), result(5, 0),
  ] })])).status, "CALENDAR_MISMATCH");
});

test("read-only guard fails closed", () => {
  const output = evaluateBollingerShadow(input([], { readOnly: false }));
  assert.equal(output.status, "READ_ONLY_GUARD_FAILED");
  assert.equal(output.cohorts.length, 0);
});

test("repeated evaluation and canonical JSON are identical", () => {
  const source = input(Array.from({ length: 30 }, (_, index) => event(index)));
  const first = evaluateBollingerShadow(source);
  const second = evaluateBollingerShadow(source);
  assert.deepEqual(first, second);
  assert.equal(canonicalPhase8Json(first), canonicalPhase8Json(second));
  assert.match(first.metadata.cohortDefinitionHash, /^fnv1a32:[0-9a-f]{8}$/);
});

test("output exposes safety metadata and no directional classification fields", () => {
  const output = evaluateBollingerShadow(input([]));
  assert.equal(output.metadata.shadowOnly, true);
  assert.equal(output.metadata.experimental, true);
  assert.equal(output.metadata.readOnly, true);
  assert.equal(output.metadata.productionConsumerInvoked, false);
  const serialized = JSON.stringify(output);
  for (const prohibitedKey of ["BUY", "SELL", "WAIT", "winRate", "directionAdjustedReturn"])
    assert.doesNotMatch(serialized, new RegExp(`"${prohibitedKey}"`, "i"));
});

const basicKeys = ["meanReturn", "medianReturn", "positiveReturnRatio", "negativeReturnRatio",
  "zeroReturnRatio", "meanMaxRise", "medianMaxRise", "meanMaxDrawdown", "medianMaxDrawdown"];
const fullKeys = ["populationStandardDeviation", "p10", "p25", "p75", "p90"];

for (const count of [29, 30, 99, 100]) {
  test(`fixed sample tier at ${count} complete observations`, () => {
    const output = evaluateBollingerShadow(input(Array.from({ length: count }, (_, i) => event(i))));
    for (const h of [1, 3, 5]) {
      const evaluated = horizon(output, h);
      assert.equal(evaluated.completeCount, count);
      assert.equal(evaluated.status, count < 30 ? "INSUFFICIENT_SAMPLE" : "COMPLETE");
      if (count < 30) assert.equal(evaluated.metrics, null);
      else assert.deepEqual(Object.keys(evaluated.metrics).sort(),
        [...basicKeys, ...(count >= 100 ? fullKeys : [])].sort());
    }
  });
}

test("V1 thresholds cannot be overridden", () => {
  const events = Array.from({ length: 30 }, (_, i) => event(i));
  for (const value of [29, 31, 100, NaN, Infinity, null, "30", true, {}]) {
    const output = evaluateBollingerShadow(input(events, { minimumSampleThreshold: value }));
    assert.equal(output.status, "INVALID_DATA");
    assert.equal(output.metadata.minimumSampleThreshold, 30);
  }
  const source = input(events);
  delete source.minimumSampleThreshold;
  assert.equal(evaluateBollingerShadow(source).status, "COMPLETE");
});

test("event and horizon reordering preserves cancellation-sensitive output without mutation", () => {
  const events = Array.from({ length: 100 }, (_, i) => event(i, {
    results: [1, 3, 5].map((h) => result(h, [1e16, -1e16, 1][i] ?? 0)),
  }));
  const before = canonicalPhase8Json(events);
  const first = evaluateBollingerShadow(input(events));
  const reordered = [events[0], events[2], events[1], ...events.slice(3).reverse()]
    .map((item) => ({ ...item, results: [...item.results].reverse() }));
  const second = evaluateBollingerShadow(input(reordered));
  assert.equal(first.status, "COMPLETE");
  assert.equal(horizon(first, 1).metrics.meanReturn, 0.01);
  assert.deepEqual(first, second);
  assert.equal(canonicalPhase8Json(first), canonicalPhase8Json(second));
  assert.equal(canonicalPhase8Json(events), before);
});

test("malformed structures return safe deterministic status objects", () => {
  const noEvents = input([]);
  delete noEvents.events;
  const noResults = event(0);
  delete noResults.results;
  const noDate = event(0);
  delete noDate.observationDate;
  for (const source of [null, undefined, false, 123, "input", [], {}, noEvents,
    input(null), input({}), input([null]), input([undefined]), input([noResults]),
    input([noDate]), input([event(0, { code: 7203 })]),
    input([event(0, { results: [null] })]), input([event(0, { results: [undefined] })]),
    input([event(0, { results: {} })]), input([event(0, { results: new Array(1) })]),
    input(new Array(1)), input([], { sourceCutoff: {} })]) {
    const output = evaluateBollingerShadow(source);
    assert.equal(output.status, "INVALID_DATA");
    assert.deepEqual(output.cohorts, []);
    assert.equal(output.metadata.sampleCount, null);
    assert.deepEqual(output, evaluateBollingerShadow(source));
    assert.doesNotThrow(() => canonicalPhase8Json(output));
  }
});

test("all failure paths avoid traversing rejected data for metadata", () => {
  const cases = [
    [input([event(0)], { readOnly: false }), "READ_ONLY_GUARD_FAILED"],
    [input([event(0)], { evaluationVersion: "OTHER" }), "VERSION_MISMATCH"],
    [input([event(0, { results: [result(1, 0, { evaluatedTradeDate: "2026-01-03" })] })]),
      "CALENDAR_MISMATCH"],
    [input([event(0, { eventId: -1 })]), "INVALID_DATA"],
  ];
  for (const [source, status] of cases) {
    const output = evaluateBollingerShadow(source);
    assert.equal(output.status, status);
    assert.deepEqual(output.cohorts, []);
    for (const key of ["evaluationVersion", "cohortDefinitionVersion", "detectorVersion",
      "resultVersion", "calendarVersion", "sourceCutoff", "sampleCount", "completeSampleCount",
      "incompleteSampleCount", "uniqueSnapshotCount", "uniqueSymbolCount", "uniqueObservationDateCount"])
      assert.equal(output.metadata[key], null);
    assert.doesNotThrow(() => canonicalPhase8Json(output));
    // The explicit read-only guard outranks structural rejection; other failures do not.
    assert.equal(evaluateBollingerShadow({ ...source, events: [...source.events, null] }).status,
      source.readOnly === false ? "READ_ONLY_GUARD_FAILED" : "INVALID_DATA");
  }
});

test("finite arithmetic overflow fails closed in means interpolation and variance", () => {
  const fixtures = [
    Array(30).fill(1e308),
    Array.from({ length: 30 }, (_, i) => i % 2 ? 1e308 : -1e308),
    Array.from({ length: 100 }, (_, i) => i % 2 ? 1e200 : -1e200),
    Array.from({ length: 100 }, (_, i) => i % 2 ? 1e154 : -1e154),
  ];
  for (const values of fixtures) {
    const source = input(values.map((value, i) => event(i, {
      results: [1, 3, 5].map((h) => result(h, value, { maxRisePercent: 0, maxDrawdownPercent: 0 })),
    })));
    const output = evaluateBollingerShadow(source);
    assert.equal(output.status, "INVALID_DATA");
    assert.equal(output.errorCode, "NON_FINITE_AGGREGATE");
    assert.deepEqual(output.cohorts, []);
    assert.doesNotThrow(() => canonicalPhase8Json(output));
  }
  for (const field of ["maxRisePercent", "maxDrawdownPercent"]) {
    const output = evaluateBollingerShadow(input(Array.from({ length: 30 }, (_, i) => event(i, {
      results: [result(1, 0, { [field]: 1e308 })],
    }))));
    assert.equal(output.status, "INVALID_DATA");
    assert.equal(output.errorCode, "NON_FINITE_AGGREGATE");
  }
});

test("canonical JSON sorts keys recursively and preserves supported values", () => {
  assert.equal(canonicalPhase8Json({ b: [null, true, 2, "x"], a: { d: 4, c: 3 } }),
    canonicalPhase8Json({ a: { c: 3, d: 4 }, b: [null, true, 2, "x"] }));
  assert.equal(canonicalPhase8Json({ b: 2, a: 1 }), '{"a":1,"b":2}');
  const shared = { a: 1 };
  assert.equal(canonicalPhase8Json([shared, shared]), '[{"a":1},{"a":1}]');
  assert.equal(canonicalPhase8Json(Object.assign(Object.create(null), { a: 1 })), '{"a":1}');
});

test("canonical JSON rejects unsupported values cycles and non-plain objects", () => {
  for (const value of [undefined, NaN, Infinity, -Infinity, 1n, () => 1, Symbol("x")]) {
    for (const source of [value, [value], { value }])
      assert.throws(() => canonicalPhase8Json(source), TypeError);
  }
  const cycle = {};
  cycle.self = cycle;
  const arrayCycle = [];
  arrayCycle.push(arrayCycle);
  const accessor = Object.defineProperty({}, "a", { enumerable: true, get() { throw Error("getter"); } });
  for (const value of [cycle, arrayCycle, new Date(0), new Map(), new Set(), new Array(1),
    { [Symbol("x")]: 1 }, accessor, Object.assign([], { extra: 1 }),
    Object.defineProperty({}, "a", { value: 1 })])
    assert.throws(() => canonicalPhase8Json(value), TypeError);
});

test("version fields require trimmed nonblank strings at every level", () => {
  for (const invalid of ["", " ", " V1 ", 1, true, {}, null, undefined]) {
    for (const field of Object.keys(versions)) {
      assert.equal(evaluateBollingerShadow(input([], { [field]: invalid })).status, "INVALID_DATA");
    }
    assert.equal(evaluateBollingerShadow(input([event(0, { detectorVersion: invalid })])).status,
      "INVALID_DATA");
    for (const field of ["resultVersion", "calendarVersion"]) {
      assert.equal(evaluateBollingerShadow(input([event(0, {
        results: [result(1, 0, { [field]: invalid })],
      })])).status, "INVALID_DATA");
    }
  }
});

test("supported evaluation versions and batch consistency fail closed on mismatch", () => {
  for (const field of ["evaluationVersion", "cohortDefinitionVersion"]) {
    assert.equal(evaluateBollingerShadow(input([], { [field]: "OTHER" })).status, "VERSION_MISMATCH");
  }
  assert.equal(evaluateBollingerShadow(input([event(0), event(1, { detectorVersion: "OTHER" })])).status,
    "VERSION_MISMATCH");
  for (const field of ["resultVersion", "calendarVersion"]) {
    assert.equal(evaluateBollingerShadow(input([event(0), event(1, {
      results: [result(1, 0), result(3, 0, { [field]: "OTHER" })],
    })])).status, "VERSION_MISMATCH");
  }
});

test("logical duplicate events are rejected without silent deduplication", () => {
  const first = event(0);
  const duplicate = { ...first, eventId: 2 };
  const output = evaluateBollingerShadow(input([first, duplicate]));
  assert.equal(output.status, "INVALID_DATA");
  assert.equal(output.errorCode, "DUPLICATE_LOGICAL_EVENT");
  assert.deepEqual(output.cohorts, []);
});

test("snapshot symbol and date conflicts fail closed", () => {
  const first = event(0);
  for (const override of [{ code: "OTHER" }, { observationDate: "2025-12-31" }]) {
    const output = evaluateBollingerShadow(input([first,
      { ...event(1), snapshotId: first.snapshotId, code: first.code, ...override }]));
    assert.equal(output.status, "INVALID_DATA");
    assert.equal(output.errorCode, "SNAPSHOT_METADATA_CONFLICT");
  }
});

test("overlapping sigma events retain correlation counts", () => {
  const first = event(0);
  const output = evaluateBollingerShadow(input([first, { ...first, eventId: 2, sigmaLevel: 3 }]));
  assert.equal(output.metadata.sampleCount, 2);
  assert.equal(output.metadata.uniqueSnapshotCount, 1);
  assert.equal(all(output).fullLifecycleCompleteCount, 2);
  assert.equal(all(output).incompleteSampleCount, 0);
  for (const sigma of [2, 3])
    assert.equal(output.cohorts.find((c) => c.key === `SIGMA:${sigma}`).sampleCount, 1);
});

test("type 7 percentiles and population deviation match known distribution", () => {
  const output = evaluateBollingerShadow(input(Array.from({ length: 100 }, (_, i) => event(i, {
    results: [1, 3, 5].map((h) => result(h, i)),
  }))));
  const m = horizon(output, 1).metrics;
  assert.equal(m.meanReturn, 49.5);
  assert.equal(m.medianReturn, 49.5);
  assert.equal(m.populationStandardDeviation, Math.sqrt(833.25));
  assert.equal(m.p10, 9.9);
  assert.equal(m.p25, 24.75);
  assert.equal(m.p75, 74.25);
  // Type 7's (n - 1) * 0.9 has this exact IEEE-754 representation.
  assert.equal(m.p90, 89.10000000000001);
});

test("population deviation divides by n and constant distributions remain zero", () => {
  for (const alternating of [false, true]) {
    const output = evaluateBollingerShadow(input(Array.from({ length: 100 }, (_, i) => event(i, {
      results: [1, 3, 5].map((h) => result(h, alternating ? (i % 2 ? 2 : -2) : 0)),
    }))));
    const m = horizon(output, 1).metrics;
    assert.equal(m.populationStandardDeviation, alternating ? 2 : 0);
    if (!alternating) {
      assert.equal(m.zeroReturnRatio, 1);
      for (const key of ["p10", "p25", "p75", "p90"]) assert.equal(m[key], 0);
    }
  }
});

test("cohort definition has the known noncryptographic FNV-1a audit hash", () => {
  assert.equal(evaluateBollingerShadow(input([])).metadata.cohortDefinitionHash, "fnv1a32:b5082ec9");
});

test("invalid identities enums dates and numeric types fail closed", () => {
  for (const override of [{ eventId: 0 }, { eventId: -1 }, { eventId: 1.5 },
    { eventId: Number.MAX_SAFE_INTEGER + 1 }, { snapshotId: -1 }, { snapshotId: 1.5 },
    { sigmaLevel: 4 }, { side: "OTHER" }, { eventType: "OTHER" }, { code: "" },
    { observationDate: "2026-02-30" }])
    assert.equal(evaluateBollingerShadow(input([event(0, override)])).status, "INVALID_DATA");
  assert.equal(evaluateBollingerShadow(input([event(0), event(0)])).status, "INVALID_DATA");
  assert.equal(evaluateBollingerShadow(input([event(0, { results: [result(2, 0)] })])).status,
    "INVALID_DATA");
  for (const field of ["returnPercent", "maxRisePercent", "maxDrawdownPercent"]) {
    for (const value of [NaN, Infinity, -Infinity, "1", null, {}, undefined])
      assert.equal(evaluateBollingerShadow(input([event(0, {
        results: [result(1, 0, { [field]: value })],
      })])).status, "INVALID_DATA");
  }
});

test("all approved statuses are reachable and missing h5 leaves h1 and h3 usable", () => {
  const output = evaluateBollingerShadow(input(Array.from({ length: 30 }, (_, i) => event(i, {
    results: [result(1, 1), result(3, 1)],
  }))));
  assert.equal(output.status, "INSUFFICIENT_SAMPLE");
  assert.equal(horizon(output, 1).status, "COMPLETE");
  assert.equal(horizon(output, 3).status, "COMPLETE");
  assert.equal(horizon(output, 5).completeCount, 0);
  assert.equal(horizon(output, 5).incompleteCount, 30);
  assert.equal(horizon(output, 5).metrics, null);
  assert.equal(output.metadata.completeSampleCount, 0);
  assert.equal(output.metadata.incompleteSampleCount, 30);
});

test("array accessors and overridden methods are rejected before execution", () => {
  let invoked = false;
  const accessor = [event(0)];
  Object.defineProperty(accessor, "0", { get() { invoked = true; throw Error("accessor"); } });
  const overridden = [result(1, 0)];
  overridden.find = null;
  const iterator = [event(0)];
  iterator[Symbol.iterator] = () => { invoked = true; throw Error("iterator"); };
  for (const source of [input(accessor), input(iterator), input([event(0, { results: overridden })])]) {
    assert.equal(evaluateBollingerShadow(source).status, "INVALID_DATA");
  }
  assert.equal(invoked, false);
});

test("populated basic and full output contain no prohibited classification fields", () => {
  for (const count of [0, 30, 100]) {
    const output = evaluateBollingerShadow(input(Array.from({ length: count }, (_, i) => event(i))));
    const serialized = canonicalPhase8Json(output);
    for (const key of ["BUY", "SELL", "WAIT", "winRate", "lossRate", "directionAdjustedReturn",
      "signalScore", "bullish", "bearish", "expectedProfit", "recommendation"]) {
      assert.doesNotMatch(serialized, new RegExp(`"${key}"`, "i"));
    }
  }
});

function assertSameFailure(forward, reverse, status, errorCode) {
  const first = evaluateBollingerShadow(forward);
  const second = evaluateBollingerShadow(reverse);
  assert.equal(first.status, status);
  assert.equal(first.errorCode, errorCode);
  assert.equal(second.status, first.status);
  assert.equal(second.errorCode, first.errorCode);
  assert.deepStrictEqual(first, second);
  assert.equal(canonicalPhase8Json(first), canonicalPhase8Json(second));
  return first;
}

test("rejected event permutations select the same version failure over calendar failure", () => {
  const events = [event(0, { detectorVersion: "OTHER" }), event(1, {
    results: [result(1, 0, { evaluatedTradeDate: "2026-01-03" })],
  })];
  assertSameFailure(input(events), input([...events].reverse()),
    "VERSION_MISMATCH", "DETECTOR_VERSION_MISMATCH");
});

test("rejected result permutations select the same version failure over calendar failure", () => {
  const results = [result(1, 0, { resultVersion: "OTHER" }),
    result(3, 0, { evaluatedTradeDate: "2026-01-07" })];
  assertSameFailure(input([event(0, { results })]),
    input([event(0, { results: [...results].reverse() })]),
    "VERSION_MISMATCH", "RESULT_VERSION_MISMATCH");
});

test("multiple invalid candidates have fixed reason precedence across permutations", () => {
  const candidates = [event(0, { eventId: -1 }),
    event(1, { results: [result(1, 0), result(1, 1)] })];
  assertSameFailure(input(candidates), input([...candidates].reverse()),
    "INVALID_DATA", "INVALID_EVENT_DATA");
  const malformed = [null, undefined, ...candidates];
  assertSameFailure(input(malformed), input([...malformed].reverse()),
    "INVALID_DATA", "INVALID_INPUT_STRUCTURE");
  const results = [result(1, 0), result(1, 1), result(3, NaN)];
  assertSameFailure(input([event(0, { results })]),
    input([event(0, { results: [...results].reverse() })]),
    "INVALID_DATA", "INVALID_RESULT_DATA");
});

test("failure precedence is read-only then invalid then version then calendar", () => {
  const events = [null, event(0, { detectorVersion: "OTHER" })];
  assertSameFailure(input(events, { readOnly: false }),
    input([...events].reverse(), { readOnly: false }), "READ_ONLY_GUARD_FAILED", "READ_ONLY_REQUIRED");
  const invalid = [event(0, { detectorVersion: "OTHER" }),
    event(1, { eventId: -1 }), event(2, { results: [
      result(1, 0, { evaluatedTradeDate: "2026-01-03" }),
    ] })];
  assertSameFailure(input(invalid), input([...invalid].reverse()), "INVALID_DATA", "INVALID_EVENT_DATA");
});

test("same-category version reasons are selected independently of event and result order", () => {
  const events = [event(0, { detectorVersion: "OTHER" }), event(1, { results: [
    result(1, 0, { resultVersion: "OTHER" }), result(3, 0, { calendarVersion: "OTHER" }),
  ] })];
  const reverse = [...events].reverse().map((item) => ({ ...item, results: [...item.results].reverse() }));
  assertSameFailure(input(events, { evaluationVersion: "OTHER" }),
    input(reverse, { evaluationVersion: "OTHER" }), "VERSION_MISMATCH", "CALENDAR_VERSION_MISMATCH");
});

test("aggregate invalid data outranks version mismatch without exposing computed cohorts", () => {
  const events = Array.from({ length: 30 }, (_, i) => event(i, {
    detectorVersion: "OTHER", results: [result(1, 1e308)],
  }));
  const output = assertSameFailure(input(events), input([...events].reverse()),
    "INVALID_DATA", "NON_FINITE_AGGREGATE");
  assert.deepEqual(output.cohorts, []);
});

test("exported horizons are frozen and h5 remains required after mutation attempts", () => {
  assert.equal(Object.isFrozen(PHASE_8_HORIZONS), true);
  for (const mutate of [
    () => PHASE_8_HORIZONS.push(7),
    () => PHASE_8_HORIZONS.splice(2, 1),
    () => { PHASE_8_HORIZONS[2] = 1; },
  ]) {
    assert.throws(mutate, TypeError);
    assert.deepEqual(PHASE_8_HORIZONS.map((h) => `h${h}`), ["h1", "h3", "h5"]);
  }
  const output = evaluateBollingerShadow(input(Array.from({ length: 30 }, (_, i) => event(i, {
    results: [result(1, 0), result(3, 0)],
  }))));
  assert.equal(output.status, "INSUFFICIENT_SAMPLE");
  assert.equal(horizon(output, 1).status, "COMPLETE");
  assert.equal(horizon(output, 3).status, "COMPLETE");
  assert.equal(horizon(output, 5).status, "INSUFFICIENT_SAMPLE");
  assert.equal(horizon(output, 5).completeCount, 0);
  assert.equal(horizon(output, 5).incompleteCount, 30);
  assert.equal(all(output).fullLifecycleCompleteCount, 0);
});
