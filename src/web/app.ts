/**
 * HTTP surface. Hono app, framework-agnostic so it runs on Node locally and on Lambda or
 * App Runner unchanged.
 *
 *   GET  /health                   liveness
 *   POST /ring/webhook             HMAC-verified Ring events, idempotent on meta.request_id
 *   GET  /ring/link/start          begins partner-initiated OAuth (PKCE) and redirects to Ring
 *   GET  /ring/link/callback       exchanges the code, fetches the account id, stores the household
 *   GET  /ring/events              stored event metadata (development aid, no media ever)
 *   DELETE /households/:id         full deletion on request (tokens, consents, events)
 */
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Config } from "../config.js";
import { DoorstepError } from "../errors.js";
import { RingClient } from "../ring/client.js";
import { parseRingEvent } from "../ring/events.js";
import { buildAuthorizeUrl, createPkce, createState, exchangeCode, type FetchLike } from "../ring/oauth.js";
import { RING_SIGNATURE_HEADER, verifyWebhookSignature } from "../ring/webhook-signature.js";
import type { Storage } from "../storage/adapter.js";

export interface AppDeps {
  config: Config;
  storage: Storage;
  fetchImpl?: FetchLike;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
}

interface PendingLink {
  verifier: string;
  createdAt: number;
}

const LINK_TTL_MS = 10 * 60 * 1000;

export function createApp(deps: AppDeps): Hono {
  const { config, storage } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const fetchImpl = deps.fetchImpl ?? fetch;
  /** state -> PKCE verifier. In-memory is fine for one process; the hosted tier moves this to storage. */
  const pendingLinks = new Map<string, PendingLink>();

  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof DoorstepError) {
      log({ level: "error", ...err.toJSON() });
      return c.json(err.toJSON(), 400);
    }
    log({ level: "error", code: "INTERNAL", message: err.message });
    return c.json({ code: "INTERNAL", message: "Unexpected error.", hint: "See server logs." }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true, service: "agentpos-doorstep" }));

  app.post("/ring/webhook", async (c) => {
    const traceId = randomUUID();
    const rawBody = new Uint8Array(await c.req.arrayBuffer());
    const verdict = verifyWebhookSignature({
      rawBody,
      signature: c.req.header(RING_SIGNATURE_HEADER),
      key: config.ring.hmacKey,
    });
    if (!verdict.ok) {
      log({ level: "warn", traceId, code: verdict.code });
      return c.json({ code: verdict.code, message: "Webhook rejected.", hint: verdict.hint }, 401);
    }
    const parsed = parseRingEvent(rawBody, now());
    if (!parsed.ok) {
      log({ level: "warn", traceId, code: parsed.code });
      return c.json({ code: parsed.code, message: "Webhook rejected.", hint: parsed.hint }, 400);
    }
    const stored = storage.insertEvent(parsed.event);
    log({
      level: "info",
      traceId,
      code: stored ? "EVENT_STORED" : "EVENT_DUPLICATE",
      eventId: parsed.event.id,
      requestId: parsed.event.requestId,
      type: parsed.event.type,
      classification: parsed.event.classification,
    });
    // Ring expects 200 within 5 seconds; matching runs after the response, never inline.
    return c.json({ ok: true, duplicate: !stored, eventId: parsed.event.id });
  });

  app.get("/ring/link/start", (c) => {
    for (const [k, v] of pendingLinks) if (now() - v.createdAt > LINK_TTL_MS) pendingLinks.delete(k);
    const state = createState();
    const pkce = createPkce();
    pendingLinks.set(state, { verifier: pkce.verifier, createdAt: now() });
    const url = buildAuthorizeUrl({
      authorizeUrl: config.ring.authorizeUrl,
      clientId: config.ring.clientId,
      redirectUri: config.ring.redirectUri,
      state,
      codeChallenge: pkce.challenge,
    });
    return c.redirect(url, 302);
  });

  app.get("/ring/link/callback", async (c) => {
    const state = c.req.query("state") ?? "";
    const code = c.req.query("code") ?? "";
    const pending = pendingLinks.get(state);
    if (!pending || now() - pending.createdAt > LINK_TTL_MS) {
      throw new DoorstepError("LINK_STATE_INVALID", "Unknown or expired state.", "Start the link again from /ring/link/start.");
    }
    pendingLinks.delete(state);
    if (!code) {
      throw new DoorstepError("LINK_CODE_MISSING", "Ring did not return an authorization code.", "The user may have declined.");
    }
    const tokens = await exchangeCode({
      tokenUrl: config.ring.oauthTokenUrl,
      clientId: config.ring.clientId,
      clientSecret: config.ring.clientSecret,
      code,
      codeVerifier: pending.verifier,
      fetchImpl,
      now: now(),
    });
    const client = new RingClient({ apiBaseUrl: config.ring.apiBaseUrl, accessToken: tokens.accessToken, fetchImpl });
    const ringAccountId = await client.getAccountId();
    const existing = storage.getHouseholdByRingAccount(ringAccountId);
    const household = {
      id: existing?.id ?? randomUUID(),
      ringAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.expiresAt,
      linkedAt: now(),
      revokedAt: null,
    };
    storage.upsertHousehold(household);
    log({ level: "info", code: "HOUSEHOLD_LINKED", householdId: household.id });
    return c.json({ ok: true, householdId: household.id });
  });

  app.get("/ring/events", (c) => {
    const ringAccountId = c.req.query("account");
    const events = storage.listEvents(ringAccountId ? { ringAccountId } : {});
    return c.json({ events });
  });

  app.delete("/households/:id", (c) => {
    const id = c.req.param("id");
    storage.deleteHouseholdData(id);
    log({ level: "info", code: "HOUSEHOLD_DELETED", householdId: id });
    return c.json({ ok: true, deleted: id });
  });

  return app;
}
