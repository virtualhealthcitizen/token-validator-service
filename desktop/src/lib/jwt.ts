import type { TokenInfo } from "../types";

/**
 * A JWT decoded WITHOUT signature verification — for inspection only.
 * The signature is intentionally NOT checked; never treat these claims as
 * validated/authorized. Use the live tokeninfo validation for that.
 */
export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface JwtDecodeResult {
  ok: boolean;
  decoded?: DecodedJwt;
  error?: string;
}

/** base64url → UTF-8 string, using only browser/Node built-ins (no Buffer). */
function base64UrlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Decode one JWT segment and assert it is a JSON object. */
function parseSegment(segment: string): Record<string, unknown> {
  const value = JSON.parse(base64UrlDecode(segment));
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("segment is not a JSON object");
  }
  return value as Record<string, unknown>;
}

/**
 * Decode a JWT's header + payload OFFLINE, WITHOUT any network call and
 * WITHOUT verifying the signature. This is a decode-only inspection helper —
 * it makes no claim that the token is valid, unexpired, or trustworthy.
 */
export function decodeJwtUnverified(token: string): JwtDecodeResult {
  const t = token.trim();
  if (!t) return { ok: false, error: "No token provided." };

  const parts = t.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      error:
        `Not a JWT: expected 3 dot-separated segments, got ${parts.length}. ` +
        `Opaque Google access tokens (e.g. "ya29.…") cannot be decoded — use Direct/Remote validation instead.`,
    };
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = parseSegment(parts[0]);
  } catch {
    return { ok: false, error: "Malformed JWT header (not valid base64url JSON)." };
  }
  try {
    payload = parseSegment(parts[1]);
  } catch {
    return { ok: false, error: "Malformed JWT payload (not valid base64url JSON)." };
  }

  return { ok: true, decoded: { header, payload } };
}

/** Render a single decoded claim value as a display string. */
export function stringifyClaimValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Flatten a decoded JWT object into a TokenInfo-shaped record (all string
 * values) so it can flow through the existing claims renderer.
 */
export function decodedToTokenInfo(record: Record<string, unknown>): TokenInfo {
  const out: TokenInfo = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined) continue;
    out[k] = stringifyClaimValue(v);
  }
  return out;
}
