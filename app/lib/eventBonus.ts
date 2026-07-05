export function getEventBonus(eventType: string) {
  switch (eventType) {
    case "EARNINGS":
      return 4;
    case "SHAREHOLDER_RETURN":
      return 3;
    case "NEWS":
      return 2;
    case "TECHNICAL_EVENT":
      return 3;
    default:
      return 0;
  }
}