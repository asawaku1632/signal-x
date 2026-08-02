const LINE_BRAND_FOOTER = `━━━━━━━━━━━━━━
⚡ SIGNALX
AI日本株分析サービス`;

const LINE_BRAND_BLOCK =
  /(?:\n*━━━━━━━━━━━━━━\n)?⚡ SIGNALX(?:\nAI日本株分析サービス)?/g;

export function withSingleLineBrand(message: string) {
  const content = message.replace(LINE_BRAND_BLOCK, "").trimEnd();
  return `${content}\n\n${LINE_BRAND_FOOTER}`;
}
