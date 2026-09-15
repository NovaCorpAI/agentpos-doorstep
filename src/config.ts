/**
 * Runtime configuration, read once from the environment. Secrets never leave the process.
 * `.env.example` lists every variable; keep both in sync.
 */
import { DoorstepError } from "./errors.js";

export interface Config {
  ring: {
    clientId: string;
    clientSecret: string;
    /** Per-app HMAC key: webhook signatures (hex) and account-linking nonces (base64url). */
    hmacKey: string;
    /** Registered HTTPS redirect URI for partner-initiated OAuth (exact match). */
    redirectUri: string;
    apiBaseUrl: string;
    oauthTokenUrl: string;
    authorizeUrl: string;
  };
  publicBaseUrl: string;
  dbPath: string;
  port: number;
}

export const RING_DEFAULTS = {
  apiBaseUrl: "https://api.amazonvision.com",
  oauthTokenUrl: "https://oauth.ring.com/oauth/token",
  authorizeUrl: "https://account.ring.com/account/integrations/partner-link/authorize",
} as const;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v || v.trim() === "") {
    throw new DoorstepError(
      "CONFIG_MISSING",
      `Missing environment variable ${name}.`,
      `Copy .env.example to .env and set ${name}.`,
    );
  }
  return v.trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const publicBaseUrl = (env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    ring: {
      clientId: required(env, "RING_CLIENT_ID"),
      clientSecret: required(env, "RING_CLIENT_SECRET"),
      hmacKey: required(env, "RING_WEBHOOK_HMAC_KEY"),
      redirectUri: env.RING_REDIRECT_URI?.trim() || `${publicBaseUrl}/ring/link/callback`,
      apiBaseUrl: env.RING_API_BASE_URL?.trim() || RING_DEFAULTS.apiBaseUrl,
      oauthTokenUrl: env.RING_OAUTH_TOKEN_URL?.trim() || RING_DEFAULTS.oauthTokenUrl,
      authorizeUrl: env.RING_AUTHORIZE_URL?.trim() || RING_DEFAULTS.authorizeUrl,
    },
    publicBaseUrl,
    dbPath: env.DOORSTEP_DB_PATH?.trim() || "./.data/doorstep.sqlite",
    port: Number(env.PORT ?? 3000),
  };
}
