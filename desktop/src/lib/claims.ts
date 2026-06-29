import type { TokenInfo } from "../types";

/** Human-friendly labels for the common Google tokeninfo claims. */
const CLAIM_LABELS: Record<string, string> = {
  aud: "Audience (aud)",
  azp: "Authorized party (azp)",
  scope: "Scopes",
  exp: "Expires at (exp)",
  expires_in: "Expires in",
  email: "Email",
  email_verified: "Email verified",
  sub: "Subject (sub)",
  access_type: "Access type",
};

/** Claims to surface first, in this order; the rest follow alphabetically. */
const PRIORITY = ["valid", "scope", "aud", "azp", "exp", "expires_in", "email", "email_verified", "access_type", "sub"];

export interface ExpiryInfo {
  /** Absolute local time, e.g. "Jun 28, 2026, 9:17 PM". */
  absolute: string;
  /** Relative phrase, e.g. "in 59 minutes" or "12 minutes ago". */
  relative: string;
  expired: boolean;
}

/** Format a unix-seconds expiry into absolute + relative, relative to `nowMs`. */
export function humanizeExpiry(expSeconds: number, nowMs: number): ExpiryInfo {
  const expMs = expSeconds * 1000;
  const deltaSec = Math.round((expMs - nowMs) / 1000);
  const expired = deltaSec <= 0;
  const absolute = new Date(expMs).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return { absolute, relative: relativeTime(deltaSec), expired };
}

/** A compact relative phrase for a signed second delta (positive = future). */
export function relativeTime(deltaSeconds: number): string {
  const past = deltaSeconds < 0;
  let s = Math.abs(deltaSeconds);
  const units: Array<[string, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  let phrase = "0 seconds";
  for (const [name, size] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      s -= n * size;
      phrase = `${n} ${name}${n === 1 ? "" : "s"}`;
      // include one finer unit for hours/minutes for a touch more precision
      if ((name === "hour" || name === "minute") && s > 0) {
        const [fname, fsize] = name === "hour" ? ["minute", 60] : ["second", 1];
        const fn = Math.floor(s / fsize);
        if (fn > 0) phrase += ` ${fn} ${fname}${fn === 1 ? "" : "s"}`;
      }
      break;
    }
  }
  return past ? `${phrase} ago` : `in ${phrase}`;
}

export interface DisplayClaim {
  key: string;
  label: string;
  value: string;
}

/** Order + label tokeninfo claims for display. `scope` is left space-joined. */
export function orderClaims(info: TokenInfo): DisplayClaim[] {
  const keys = Object.keys(info).filter((k) => info[k] !== undefined && info[k] !== "");
  keys.sort((a, b) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return keys.map((key) => ({
    key,
    label: CLAIM_LABELS[key] ?? key,
    value: String(info[key]),
  }));
}

/** Split a space-delimited scope string into individual scopes. */
export function splitScopes(scope: string | undefined): string[] {
  if (!scope) return [];
  return scope.split(/\s+/).filter(Boolean);
}
