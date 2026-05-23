/**
 * Money formatting. All amounts in the DB are integer minor units.
 * Display is via Intl.NumberFormat with currency-aware minor-unit handling
 * (e.g. JPY has 0 fraction digits; most currencies have 2).
 */

const ZERO_DECIMAL = new Set([
  "JPY",
  "KRW",
  "VND",
  "UGX",
  "RWF",
  "XOF",
  "XAF",
  "CLP",
]);

export function minorUnitsToString(amount: number, currency: string): string {
  const digits = ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
  const factor = digits === 0 ? 1 : Math.pow(10, digits);
  return (amount / factor).toFixed(digits);
}

export function formatMoney(amount: number, currency: string): string {
  const digits = ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
  const factor = digits === 0 ? 1 : Math.pow(10, digits);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(amount / factor);
  } catch {
    return `${currency} ${(amount / factor).toFixed(digits)}`;
  }
}

export function stringToMinorUnits(input: string, currency: string): number {
  const digits = ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") {
    throw new Error("Invalid amount");
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num)) throw new Error("Invalid amount");
  return Math.round(num * Math.pow(10, digits));
}
