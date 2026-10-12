/** Fixed, declared BEFORE loading outcomes. They are purposive examples, NOT a random JPX sample. */
export const MSB_PRESETS = {
  A: ["3182","3387","6855","7203","9984"],
  B: ["1605","2760","3994","5805","8058"],
  C: ["8306","8316","8411","8604","8591"],
  D: ["6501","6758","6861","6702","6954"],
  E: ["9432","9433","9613","4755","4689"],
  F: ["4502","4568","4519","4523","4578"],
  G: ["8035","7974","6920","7741","6367"],
  H: ["8001","8002","8053","7201","7267"],
} as const;
export type MsbPreset = keyof typeof MSB_PRESETS;
export const MSB_PRESET_GROUPS: readonly { key: MsbPreset; label: string }[] = [
  { key: "A", label: "A（これまで）" }, { key: "B", label: "B（これまで）" },
  { key: "C", label: "C（金融）" }, { key: "D", label: "D（電機・機械）" },
  { key: "E", label: "E（情報通信）" }, { key: "F", label: "F（医薬品）" },
  { key: "G", label: "G（半導体・精密）" }, { key: "H", label: "H（商社・自動車）" },
];
export const msbPresetCodes = (key: string): readonly string[] | null =>
  Object.hasOwn(MSB_PRESETS, key) ? MSB_PRESETS[key as MsbPreset] : null;

const originalCodes = new Set<string>([...MSB_PRESETS.A,...MSB_PRESETS.B]);
const additionalCodes = new Set<string>([
  ...MSB_PRESETS.C,...MSB_PRESETS.D,...MSB_PRESETS.E,
  ...MSB_PRESETS.F,...MSB_PRESETS.G,...MSB_PRESETS.H,
]);
export function classifyMsbResearchCode(code: string): "DISCOVERY" | "ADDITIONAL" | "CUSTOM" {
  return originalCodes.has(code) ? "DISCOVERY" : additionalCodes.has(code) ? "ADDITIONAL" : "CUSTOM";
}
