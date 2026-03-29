import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(cents: number): string {
  return `KES ${(cents / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-KE");
}

const HASH64 = /^[a-fA-F0-9]{64}$/i;

/** Kenya MSISDN digits only, 254… */
function normalizeKenyanMsisdnDigits(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "254" + d.slice(1);
  if (d.startsWith("254")) return d.length >= 12 ? d : d.length === 11 ? "254" + d.slice(3) : d;
  if (d.length === 9 && d.startsWith("7")) return "254" + d;
  if (d.length >= 9 && d.startsWith("7")) return "254" + d;
  return null;
}

/**
 * Default list view: +2547 + masked middle + last 3 digits (Kenya mobile).
 * C2B hashed MSISDN (64 hex): same shape with last 3 chars of hash as tail identifier.
 */
export function maskMsisdnDisplay(value: string | undefined | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";

  if (HASH64.test(raw)) {
    return `+2547•••••••${raw.slice(-3)}`;
  }

  const d = normalizeKenyanMsisdnDigits(raw);
  if (d && d.startsWith("254") && d.length >= 12) {
    const rest = d.slice(3);
    if (rest.length < 4) return "+2547•••";
    const last3 = rest.slice(-3);
    const afterSeven = rest.slice(1, -3);
    const bullets = "•".repeat(Math.max(4, afterSeven.length));
    return `+2547${bullets}${last3}`;
  }

  if (raw.length <= 4) return "***";
  return `+2547${"•".repeat(Math.max(4, raw.length - 7))}${raw.slice(-3)}`;
}

/** Pretty-print Kenya MSISDN for admin reveal (+254 712 345 678). */
export function formatKeMsisdnReadable(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw || raw === "—") return raw;
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("254") && d.length >= 12) {
    const r = d.slice(3, 12);
    if (r.length >= 9) return `+254 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 9)}`;
  }
  return raw;
}
