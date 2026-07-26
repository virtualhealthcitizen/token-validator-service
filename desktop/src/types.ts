import type { DecodedJwt } from "./lib/jwt";

export type Mode = "direct" | "remote" | "decode";

/** Google tokeninfo claims (all string-valued over the wire). */
export interface TokenInfo {
  [claim: string]: string | undefined;
  aud?: string;
  azp?: string;
  scope?: string;
  exp?: string;
  expires_in?: string;
  email?: string;
  email_verified?: string;
  sub?: string;
  access_type?: string;
}

export interface ValidateResult {
  ok: boolean;
  valid?: boolean;
  status?: number;
  tokenInfo?: TokenInfo;
  /** Present only for offline decode-only mode — an UNVERIFIED decode, never validation. */
  decoded?: DecodedJwt;
  error?: string;
  mode?: Mode;
}

export interface ValidatePayload {
  token: string;
  mode: Mode;
  serviceUrl?: string;
}

declare global {
  interface Window {
    tv?: {
      isElectron: boolean;
      platform: string;
      validateToken: (payload: ValidatePayload) => Promise<ValidateResult>;
      openExternal: (url: string) => Promise<boolean>;
      onToggleTheme: (cb: () => void) => () => void;
    };
  }
}
