export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number.");
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}
