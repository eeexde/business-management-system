import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format integer cents as currency, e.g. 123456 -> "$1,234.56". */
export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** Parse user-entered money ("1,234.5", "$12") into integer cents. Returns NaN when invalid. */
export function parseMoney(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return NaN;
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*(\.\d+)?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

/** Cents to a plain decimal string for form inputs, e.g. 123456 -> "1234.56". */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

/** "2026-03-07" -> "Mar 7, 2026". Parses as a local calendar date (no timezone shift). */
export function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today's date as YYYY-MM-DD in local time. */
export function today() {
  return toISODate(new Date());
}

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
