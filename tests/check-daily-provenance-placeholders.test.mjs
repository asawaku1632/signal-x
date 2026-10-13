import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("../app/lib/learning/checkDailyRunner.ts", import.meta.url));
const source = readFileSync(runnerPath, "utf8");
const begin = source.indexOf("async function saveDailyResultProvenance(");
const end = source.indexOf("  // Same database transaction", begin);
assert.ok(begin >= 0 && end > begin, "Provenance insert implementation must exist");
const snippet = source.slice(begin, end).match(
  /const values: string\[\] = \[\];\s*const placeholders = updates\.map\(\(item, index\) => \{[\s\S]*?\n  \}\);/,
);
assert.ok(snippet, "Find the actual production placeholder generator");
// Execute only the isolated, dependency-free generator (not the database operation).
const generate = new Function(
  "updates",
  `${snippet[0].replace("const values: string[]", "const values")}\nreturn { values, placeholders };`,
);

test("provenance bind positions cover all supplied values, including a 200-row batch", () => {
  for (const count of [1, 2, 100, 200]) {
    const updates = Array.from({ length: count }, (_, i) => ({
      id: `result-${i}`, sourceRowId: `source-${i}`,
    }));
    const { values, placeholders } = generate(updates);
    assert.equal(placeholders.length, count);
    assert.equal(values.length, count * 2);
    const positions = [...placeholders.join(",").matchAll(/\$(\d+)::text/g)].map((m) => Number(m[1]));
    assert.deepEqual(positions, Array.from({ length: count * 2 }, (_, i) => i + 1));
    assert.equal(values[0], "result-0");
    assert.equal(values.at(-1), `source-${count - 1}`);
  }
});
