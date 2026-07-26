import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Mode, ValidatePayload, ValidateResult } from "./types";
import { humanizeExpiry, orderClaims, splitScopes } from "./lib/claims";
import { decodeJwtUnverified, decodedToTokenInfo } from "./lib/jwt";

const DEFAULT_SERVICE_URL = "https://token-validator-service-5afqr6ijoq-uc.a.run.app";
const TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";

// Persist UI preferences (mode, service URL, theme) — NEVER the token.
const LS_MODE = "tv.mode";
const LS_URL = "tv.serviceUrl";
const LS_THEME = "tv.theme";

/** Browser fallback when not running inside Electron (no window.tv bridge). */
async function validateInBrowser(p: ValidatePayload): Promise<ValidateResult> {
  try {
    if (p.mode === "remote") {
      const base = (p.serviceUrl || "").replace(/\/+$/, "");
      if (!base) return { ok: false, error: "No service URL configured for Remote mode." };
      const res = await fetch(`${base}/api/validate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: p.token }),
      });
      const body = await res.json().catch(() => ({}));
      return {
        ok: true,
        valid: Boolean(body.valid),
        status: res.status,
        tokenInfo: body.token_info,
        error: body.valid ? undefined : body.error || `Service returned ${res.status}`,
        mode: "remote",
      };
    }
    const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(p.token)}`);
    const info = await res.json().catch(() => ({}));
    return res.ok
      ? { ok: true, valid: true, status: res.status, tokenInfo: info, mode: "direct" }
      : {
          ok: true,
          valid: false,
          status: res.status,
          error: info.error_description || info.error || "Invalid or expired token",
          mode: "direct",
        };
  } catch (err) {
    return { ok: false, error: `Request failed: ${(err as Error)?.message ?? "network error"}` };
  }
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  // Wire the Electron View → Toggle Theme menu command.
  useEffect(() => window.tv?.onToggleTheme(toggle), [toggle]);
  return [theme, toggle];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(LS_MODE) as Mode) || "direct");
  const [serviceUrl, setServiceUrl] = useState(() => localStorage.getItem(LS_URL) || DEFAULT_SERVICE_URL);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => localStorage.setItem(LS_MODE, mode), [mode]);
  useEffect(() => localStorage.setItem(LS_URL, serviceUrl), [serviceUrl]);
  useEffect(() => taRef.current?.focus(), []);

  const isElectron = Boolean(window.tv?.isElectron);

  const validate = useCallback(async () => {
    const t = token.trim();
    if (!t || busy) return;
    setResult(null);
    setCopied(false);
    // Decode-only: purely local, no network, no signature check.
    if (mode === "decode") {
      const d = decodeJwtUnverified(t);
      setResult(d.ok ? { ok: true, decoded: d.decoded, mode: "decode" } : { ok: false, error: d.error });
      return;
    }
    setBusy(true);
    const payload: ValidatePayload = { token: t, mode, serviceUrl };
    const r = window.tv ? await window.tv.validateToken(payload) : await validateInBrowser(payload);
    setResult(r);
    setBusy(false);
  }, [token, mode, serviceUrl, busy]);

  const clear = useCallback(() => {
    setToken(""); // wipe the secret from state
    setResult(null);
    setCopied(false);
    taRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void validate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clear();
    }
  };

  const claims = useMemo(
    () => (result?.tokenInfo ? orderClaims(result.tokenInfo) : []),
    [result]
  );
  const scopes = useMemo(() => splitScopes(result?.tokenInfo?.scope), [result]);
  const expiry = useMemo(() => {
    const exp = result?.tokenInfo?.exp;
    return exp ? humanizeExpiry(Number(exp), Date.now()) : null;
  }, [result]);

  // Offline decode-only view — reuses the claims renderer; NEVER validation.
  const decodedHeaderClaims = useMemo(
    () => (result?.decoded ? orderClaims(decodedToTokenInfo(result.decoded.header)) : []),
    [result]
  );
  const decodedPayloadClaims = useMemo(
    () => (result?.decoded ? orderClaims(decodedToTokenInfo(result.decoded.payload)) : []),
    [result]
  );
  const decodedExpiry = useMemo(() => {
    const exp = result?.decoded?.payload?.exp;
    return typeof exp === "number" ? humanizeExpiry(exp, Date.now()) : null;
  }, [result]);

  const copyJson = useCallback(async () => {
    const data = result?.decoded ?? result?.tokenInfo;
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [result]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🔐</span>
          <div>
            <h1>Token Validator</h1>
            <p className="sub">Validate a Google OAuth access token and read its claims</p>
          </div>
        </div>
        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>

      <section className="panel">
        <label className="field-label" htmlFor="token">Access token</label>
        <textarea
          id="token"
          ref={taRef}
          className="token-input"
          placeholder="ya29.…  (paste a Google OAuth access token, then ⌘/Ctrl+Enter)"
          value={token}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={onKeyDown}
          rows={4}
        />

        <div className="controls">
          <div className="mode-toggle" role="tablist" aria-label="Validation mode">
            <button
              role="tab"
              aria-selected={mode === "direct"}
              className={mode === "direct" ? "seg active" : "seg"}
              onClick={() => setMode("direct")}
            >
              Direct
            </button>
            <button
              role="tab"
              aria-selected={mode === "remote"}
              className={mode === "remote" ? "seg active" : "seg"}
              onClick={() => setMode("remote")}
            >
              Remote
            </button>
            <button
              role="tab"
              aria-selected={mode === "decode"}
              className={mode === "decode" ? "seg active" : "seg"}
              onClick={() => setMode("decode")}
              title="Decode a JWT offline without verifying its signature"
            >
              Decode only (offline)
            </button>
          </div>

          {mode === "remote" && (
            <input
              className="url-input"
              type="url"
              value={serviceUrl}
              spellCheck={false}
              onChange={(e) => setServiceUrl(e.target.value)}
              placeholder="https://your-token-validator…/"
              aria-label="Service URL"
            />
          )}

          <div className="spacer" />

          <button className="btn ghost" onClick={clear} disabled={!token && !result}>
            Clear
          </button>
          <button className="btn primary" onClick={() => void validate()} disabled={!token.trim() || busy}>
            {busy ? "Validating…" : mode === "decode" ? "Decode" : "Validate"}
          </button>
        </div>

        <p className="mode-hint">
          {mode === "direct"
            ? "Direct: the app calls Google’s tokeninfo endpoint itself — no backend needed."
            : mode === "remote"
            ? "Remote: posts to your token-validator-service (e.g. a local Flask, or an unauthenticated deployment)."
            : "Decode only: reads a JWT’s header + payload entirely offline — no network call, and the signature is NOT verified. This is inspection, not validation."}
          {" "}The token is never stored or logged.
        </p>
      </section>

      {result && (
        <section
          className={`result ${
            result.decoded ? "decode" : result.valid ? "ok" : result.ok ? "bad" : "err"
          }`}
        >
          {result.decoded ? (
            <>
              <div className="result-head-row">
                <p className="result-head">🔓 Decoded · signature NOT verified</p>
                <button className="btn tiny" onClick={() => void copyJson()}>
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>

              <p className="decode-warning">
                Offline decode only. The signature was <strong>not</strong> checked and the token
                may be forged, tampered, or expired — do not trust these claims for authorization.
              </p>

              {decodedExpiry && (
                <p className={`expiry ${decodedExpiry.expired ? "expired" : ""}`}>
                  {decodedExpiry.expired ? "Expired " : "Expires "} {decodedExpiry.relative} ·{" "}
                  {decodedExpiry.absolute}
                </p>
              )}

              <p className="decode-section-label">Payload</p>
              <table className="claims">
                <tbody>
                  {decodedPayloadClaims.map((c) => (
                    <tr key={c.key}>
                      <th>{c.label}</th>
                      <td>{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="decode-section-label">Header</p>
              <table className="claims">
                <tbody>
                  {decodedHeaderClaims.map((c) => (
                    <tr key={c.key}>
                      <th>{c.label}</th>
                      <td>{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : !result.ok ? (
            <p className="result-head">⚠ {result.error}</p>
          ) : result.valid ? (
            <>
              <div className="result-head-row">
                <p className="result-head">✓ Valid token{result.mode ? ` · ${result.mode}` : ""}</p>
                <button className="btn tiny" onClick={() => void copyJson()}>
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>

              {expiry && (
                <p className={`expiry ${expiry.expired ? "expired" : ""}`}>
                  {expiry.expired ? "Expired " : "Expires "} {expiry.relative} · {expiry.absolute}
                </p>
              )}

              {scopes.length > 0 && (
                <div className="scopes">
                  {scopes.map((s) => (
                    <span className="chip" key={s} title={s}>
                      {s.replace(/^https:\/\/www\.googleapis\.com\/auth\//, "…/")}
                    </span>
                  ))}
                </div>
              )}

              <table className="claims">
                <tbody>
                  {claims
                    .filter((c) => c.key !== "scope")
                    .map((c) => (
                      <tr key={c.key}>
                        <th>{c.label}</th>
                        <td>{c.value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="result-head">✕ {result.error || "Invalid or expired token"}{result.status ? ` (HTTP ${result.status})` : ""}</p>
          )}
        </section>
      )}

      <footer className="foot">
        <span>{isElectron ? "Desktop" : "Web"} · tokens stay in memory only</span>
        <a
          href="https://github.com/virtualhealthcitizen/token-validator-service"
          onClick={(e) => {
            if (window.tv) {
              e.preventDefault();
              void window.tv.openExternal("https://github.com/virtualhealthcitizen/token-validator-service");
            }
          }}
        >
          token-validator-service ↗
        </a>
      </footer>
    </div>
  );
}
