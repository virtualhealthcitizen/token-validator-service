import { describe, it, expect } from "vitest";
import { humanizeExpiry, relativeTime, orderClaims, splitScopes } from "./claims";

describe("relativeTime", () => {
  it("formats future deltas with an 'in' prefix", () => {
    expect(relativeTime(59 * 60)).toBe("in 59 minutes");
    expect(relativeTime(60)).toBe("in 1 minute");
    expect(relativeTime(1)).toBe("in 1 second");
  });

  it("formats past deltas with an 'ago' suffix", () => {
    expect(relativeTime(-120)).toBe("2 minutes ago");
    expect(relativeTime(-1)).toBe("1 second ago");
  });

  it("adds a finer unit for hours and minutes", () => {
    expect(relativeTime(3 * 3600 + 5 * 60)).toBe("in 3 hours 5 minutes");
    expect(relativeTime(2 * 60 + 30)).toBe("in 2 minutes 30 seconds");
  });

  it("handles days", () => {
    expect(relativeTime(2 * 86400)).toBe("in 2 days");
  });
});

describe("humanizeExpiry", () => {
  const now = 1_000_000_000_000; // fixed reference

  it("marks a future expiry as not expired", () => {
    const r = humanizeExpiry(now / 1000 + 3600, now);
    expect(r.expired).toBe(false);
    expect(r.relative).toBe("in 1 hour");
    expect(typeof r.absolute).toBe("string");
    expect(r.absolute.length).toBeGreaterThan(0);
  });

  it("marks a past expiry as expired", () => {
    const r = humanizeExpiry(now / 1000 - 60, now);
    expect(r.expired).toBe(true);
    expect(r.relative).toBe("1 minute ago");
  });

  it("treats exactly-now as expired", () => {
    expect(humanizeExpiry(now / 1000, now).expired).toBe(true);
  });
});

describe("orderClaims", () => {
  it("puts priority claims first and drops empties", () => {
    const claims = orderClaims({
      sub: "123",
      scope: "email openid",
      zzz: "last",
      aud: "client",
      empty: "",
    });
    const keys = claims.map((c) => c.key);
    expect(keys[0]).toBe("scope");
    expect(keys[1]).toBe("aud");
    expect(keys).not.toContain("empty");
    expect(keys[keys.length - 1]).toBe("zzz"); // non-priority, alphabetical-last
  });

  it("labels known claims", () => {
    const [first] = orderClaims({ scope: "email" });
    expect(first.label).toBe("Scopes");
    expect(first.value).toBe("email");
  });
});

describe("splitScopes", () => {
  it("splits on whitespace and drops blanks", () => {
    expect(splitScopes("email  openid   profile")).toEqual(["email", "openid", "profile"]);
  });
  it("returns [] for undefined", () => {
    expect(splitScopes(undefined)).toEqual([]);
  });
});
