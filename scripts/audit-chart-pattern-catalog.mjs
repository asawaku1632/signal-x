import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineSource = readFileSync(resolve(root, "app/lib/chartPatternEngine.ts"), "utf8");
const catalogSource = readFileSync(resolve(root, "app/lib/chartPatternCatalog.ts"), "utf8");

const engineById = new Map();
for (const match of engineSource.matchAll(/pushPattern\(patterns,\s*\{([\s\S]*?)\n\s*\}\);/g)) {
  const block = match[1];
  const id = block.match(/id:\s*"([^"]+)"/)?.[1];
  const nameExpression = block.match(
    /name:\s*([\s\S]*?),\s*\n\s*direction(?:\s*:|\s*,)/,
  )?.[1];
  if (!id || !nameExpression) continue;
  const names = [...nameExpression.matchAll(/"([^"]+)"/g)]
    .map((item) => item[1])
    .filter((name) => !["BUY", "SELL", "NEUTRAL"].includes(name));
  engineById.set(id, [...new Set(names)]);
}

const catalogEntries = [...catalogSource.matchAll(/id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*engineNames:\s*\[([^\]]+)\]/g)].map((match) => ({
  id: match[1],
  catalogName: match[2],
  engineNames: [...match[3].matchAll(/"([^"]+)"/g)].map((item) => item[1]),
}));
const catalogIds = catalogEntries.map((item) => item.id);
const duplicateIds = [...new Set(catalogIds.filter((id, index) => catalogIds.indexOf(id) !== index))];
const missingIds = [...engineById.keys()].filter((id) => !catalogIds.includes(id));
const extraIds = [...new Set(catalogIds)].filter((id) => !engineById.has(id));
const nameMismatches = catalogEntries.flatMap((entry) => {
  const engineNames = engineById.get(entry.id) ?? [];
  const missingNames = engineNames.filter((name) => !entry.engineNames.includes(name));
  const extraNames = entry.engineNames.filter((name) => !engineNames.includes(name));
  return missingNames.length || extraNames.length ? [{ id: entry.id, engineNames, catalogEngineNames: entry.engineNames }] : [];
});

const result = {
  engineIdCount: engineById.size,
  catalogIdCount: new Set(catalogIds).size,
  missingIds,
  extraIds,
  duplicateIds,
  nameMismatches,
};
console.log(JSON.stringify(result, null, 2));
if (missingIds.length || extraIds.length || duplicateIds.length || nameMismatches.length) process.exitCode = 1;
