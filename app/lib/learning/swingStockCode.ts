// Research-only ticker validation. Keep live trading and provider adapters unchanged.
// TSE alphanumeric codes use three digits followed by one uppercase letter.
export function isSwingResearchStockCode(code: string): boolean {
  return /^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(code);
}
