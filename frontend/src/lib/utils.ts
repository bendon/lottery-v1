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

/**
 * MSISDN for lists: always masked. Plain phones → same pattern as presenter API (254*****78).
 * M-Pesa C2B often sends a 64-char SHA-256 hash — show a phone-like placeholder + last 4 for support.
 * Full / decoded numbers belong after a draw (e.g. winner endpoints), not in the transaction list.
 */
export function maskMsisdnDisplay(value: string | undefined | null): string {
  const phone = (value ?? "").trim();
  if (!phone) return "—";
  // Hashed MSISDN from Daraja C2B
  if (/^[a-fA-F0-9]{64}$/i.test(phone)) {
    return `254••••••••${phone.slice(-4)}`;
  }
  if (phone.length <= 4) return "***";
  return phone.slice(0, 3) + "•".repeat(Math.max(1, phone.length - 5)) + phone.slice(-2);
}
