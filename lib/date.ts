export function parseDate(dateString: string): Date {
  const normalized = dateString.trim().toLowerCase();
  const base = new Date();

  if (normalized === "today") {
    return base;
  }

  if (normalized === "tomorrow") {
    const result = new Date(base);
    result.setDate(result.getDate() + 1);
    return result;
  }

  const inDays = normalized.match(/^in\s+(\d+)\s+days?$/);
  if (inDays) {
    const days = Number(inDays[1]);
    const result = new Date(base);
    result.setDate(result.getDate() + days);
    return result;
  }

  throw new Error("Unsupported date format.");
}
