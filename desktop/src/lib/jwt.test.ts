import { describe, it, expect } from "vitest";
import { decodeJwtUnverified, decodedToTokenInfo, stringifyClaimValue } from "./jwt";

/** base64url-encode a UTF-8 string (test-side helper, no padding). */
function b64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(header: unknown, payload: unknown, signature = "sig"): string {
  return `${b64url(header)}.${b64url(payload)}.${signature}`;
}

describe("decodeJwtUnverified", () => {
  it("decodes header and payload without touching the signature", () => {
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { sub: "abc123", email: "user@example.com", exp: 1_700_000_000, admin: true };
    const r = decodeJwtUnverified(makeJwt(header, payload, "not-a-real-signature"));
    expect(r.ok).toBe(true);
    expect(r.decoded?.header).toEqual(header);
    expect(r.decoded?.payload).toEqual(payload);
  });

  it("decodes correctly regardless of an invalid signature (no verification)", () => {
    const r = decodeJwtUnverified(makeJwt({ alg: "HS256" }, { sub: "1" }, "tampered!!!"));
    expect(r.ok).toBe(true);
    expect(r.decoded?.payload).toEqual({ sub: "1" });
  });

  it("handles UTF-8 payload values", () => {
    const r = decodeJwtUnverified(makeJwt({ alg: "none" }, { name: "Renée Müller ☕" }));
    expect(r.decoded?.payload.name).toBe("Renée Müller ☕");
  });

  it("trims surrounding whitespace before decoding", () => {
    const jwt = makeJwt({ alg: "none" }, { sub: "x" });
    expect(decodeJwtUnverified(`  ${jwt}\n`).ok).toBe(true);
  });

  it("rejects an empty token", () => {
    const r = decodeJwtUnverified("   ");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no token/i);
  });

  it("rejects opaque (non-JWT) tokens without 3 segments", () => {
    const r = decodeJwtUnverified("ya29.a0AfB_opaqueGoogleAccessToken");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/expected 3 dot-separated segments/i);
  });

  it("rejects a malformed base64url payload", () => {
    const r = decodeJwtUnverified(`${b64url({ alg: "none" })}.@@@not-base64@@@.sig`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/malformed jwt payload/i);
  });

  it("rejects a non-object payload segment", () => {
    const r = decodeJwtUnverified(`${b64url({ alg: "none" })}.${b64url([1, 2, 3])}.sig`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/malformed jwt payload/i);
  });
});

describe("stringifyClaimValue", () => {
  it("renders primitives verbatim and objects/arrays as JSON", () => {
    expect(stringifyClaimValue("hello")).toBe("hello");
    expect(stringifyClaimValue(42)).toBe("42");
    expect(stringifyClaimValue(true)).toBe("true");
    expect(stringifyClaimValue(null)).toBe("null");
    expect(stringifyClaimValue(["a", "b"])).toBe('["a","b"]');
    expect(stringifyClaimValue({ k: 1 })).toBe('{"k":1}');
  });
});

describe("decodedToTokenInfo", () => {
  it("stringifies values and drops undefined so the claims renderer can consume it", () => {
    const info = decodedToTokenInfo({ sub: "1", exp: 1700, roles: ["a"], skip: undefined });
    expect(info).toEqual({ sub: "1", exp: "1700", roles: '["a"]' });
    expect(Object.prototype.hasOwnProperty.call(info, "skip")).toBe(false);
  });
});
