/**
 * Partner-initiated OAuth 2.0 account linking with PKCE (S256), per the Ring Partner API.
 *
 *   authorize: https://account.ring.com/account/integrations/partner-link/authorize
 *              ?client_id&redirect_uri&response_type=code&scope=ava.v1:read&state
 *              &code_challenge&code_challenge_method=S256
 *   token:     POST https://oauth.ring.com/oauth/token (form encoded)
 *
 * `fetch` is injectable so tests never touch the network.
 */
import { createHash, randomBytes } from "node:crypto";
import { DoorstepError } from "../errors.js";

export const RING_SCOPE = "ava.v1:read";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkce(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthorizeUrl(input: {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(input.authorizeUrl);
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", RING_SCOPE);
  u.searchParams.set("state", input.state);
  u.searchParams.set("code_challenge", input.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Unix ms. */
  expiresAt: number;
  scope: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function tokenRequest(
  url: string,
  params: Record<string, string>,
  fetchImpl: FetchLike,
  now: number,
): Promise<TokenSet> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DoorstepError(
      "RING_OAUTH_FAILED",
      `Ring token endpoint returned ${res.status}.`,
      `Check RING_CLIENT_ID, RING_CLIENT_SECRET and the redirect URI registered in the console. Response: ${text.slice(0, 200)}`,
    );
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new DoorstepError("RING_OAUTH_FAILED", "Ring token endpoint returned non-JSON.", text.slice(0, 200));
  }
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : "";
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 0;
  if (!accessToken || !refreshToken) {
    throw new DoorstepError("RING_OAUTH_FAILED", "Token response lacks access_token or refresh_token.", text.slice(0, 200));
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: now + expiresIn * 1000,
    scope: typeof json.scope === "string" ? json.scope : RING_SCOPE,
  };
}

export function exchangeCode(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  fetchImpl?: FetchLike;
  now?: number;
}): Promise<TokenSet> {
  return tokenRequest(
    input.tokenUrl,
    {
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    },
    input.fetchImpl ?? fetch,
    input.now ?? Date.now(),
  );
}

export function refreshTokens(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: FetchLike;
  now?: number;
}): Promise<TokenSet> {
  return tokenRequest(
    input.tokenUrl,
    {
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    },
    input.fetchImpl ?? fetch,
    input.now ?? Date.now(),
  );
}
