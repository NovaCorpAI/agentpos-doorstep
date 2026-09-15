import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { signWebhookBody } from "../src/ring/webhook-signature.js";
import { SqliteStorage } from "../src/storage/sqlite.js";
import { createApp } from "../src/web/app.js";

const config: Config = {
  ring: {
    clientId: "cid",
    clientSecret: "csec",
    hmacKey: "hmac-key",
    redirectUri: "https://doorstep.test/ring/link/callback",
    apiBaseUrl: "https://api.ring.test",
    oauthTokenUrl: "https://oauth.ring.test/oauth/token",
    authorizeUrl: "https://account.ring.test/authorize",
  },
  publicBaseUrl: "https://doorstep.test",
  dbPath: ":memory:",
  port: 0,
};

const body = JSON.stringify({
  meta: { request_id: "req-1", account_id: "acct-1", timestamp: 1_760_000_000 },
  data: { id: "evt-1", type: "motion_detected", attributes: { sub_type: "package", source: "dev-1" } },
});

let storage: SqliteStorage;
let logs: Record<string, unknown>[];

beforeEach(() => {
  storage = new SqliteStorage(":memory:");
  logs = [];
});
afterEach(() => storage.close());

function app(fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>) {
  return createApp({
    config,
    storage,
    log: (e) => logs.push(e),
    now: () => 1_760_000_500_000,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

describe("POST /ring/webhook", () => {
  it("stores a correctly signed event and is idempotent on request_id", async () => {
    const a = app();
    const headers = { "X-Signature": signWebhookBody(body, "hmac-key"), "Content-Type": "application/json" };
    const first = await a.request("/ring/webhook", { method: "POST", body, headers });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, duplicate: false, eventId: "evt-1" });
    const second = await a.request("/ring/webhook", { method: "POST", body, headers });
    expect(await second.json()).toEqual({ ok: true, duplicate: true, eventId: "evt-1" });
    expect(storage.listEvents()).toHaveLength(1);
    expect(storage.listEvents()[0]?.classification).toBe("package");
  });

  it("rejects an unsigned or badly signed webhook with 401 before parsing", async () => {
    const a = app();
    const none = await a.request("/ring/webhook", { method: "POST", body });
    expect(none.status).toBe(401);
    expect(((await none.json()) as { code: string }).code).toBe("WEBHOOK_SIGNATURE_MISSING");
    const wrong = await a.request("/ring/webhook", {
      method: "POST",
      body,
      headers: { "X-Signature": signWebhookBody(body, "other") },
    });
    expect(wrong.status).toBe(401);
    expect(storage.listEvents()).toHaveLength(0);
  });

  it("rejects a signed but malformed payload with 400", async () => {
    const a = app();
    const raw = "{\"meta\":{}}";
    const r = await a.request("/ring/webhook", {
      method: "POST",
      body: raw,
      headers: { "X-Signature": signWebhookBody(raw, "hmac-key") },
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("WEBHOOK_PAYLOAD_INVALID");
  });
});

describe("account linking", () => {
  it("redirects to Ring with PKCE and state, then stores the household on callback", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push(`${init?.method ?? "GET"} ${input}`);
      if (input === config.ring.oauthTokenUrl) {
        const params = new URLSearchParams(String(init?.body));
        expect(params.get("grant_type")).toBe("authorization_code");
        expect(params.get("code")).toBe("the-code");
        expect(params.get("code_verifier")).toBeTruthy();
        return new Response(
          JSON.stringify({ access_token: "AT", refresh_token: "RT", expires_in: 14400, scope: "ava", token_type: "Bearer" }),
          { status: 200 },
        );
      }
      if (input === `${config.ring.apiBaseUrl}/v1/users/me`) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer AT");
        return new Response(JSON.stringify({ data: { id: "acct-77", attributes: { account_id: "acct-77" } } }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
    const a = app(fetchImpl);

    const start = await a.request("/ring/link/start");
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://account.ring.test/authorize");
    expect(location.searchParams.get("client_id")).toBe("cid");
    expect(location.searchParams.get("scope")).toBe("ava.v1:read");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    const state = location.searchParams.get("state") ?? "";
    expect(state).not.toBe("");

    const cb = await a.request(`/ring/link/callback?state=${encodeURIComponent(state)}&code=the-code`);
    expect(cb.status).toBe(200);
    const json = (await cb.json()) as { ok: boolean; householdId: string };
    expect(json.ok).toBe(true);
    const h = storage.getHouseholdByRingAccount("acct-77");
    expect(h?.id).toBe(json.householdId);
    expect(h?.refreshToken).toBe("RT");
    expect(h?.accessTokenExpiresAt).toBe(1_760_000_500_000 + 14400 * 1000);
    expect(calls).toEqual([`POST ${config.ring.oauthTokenUrl}`, `GET ${config.ring.apiBaseUrl}/v1/users/me`]);
  });

  it("rejects a callback with an unknown state", async () => {
    const a = app();
    const r = await a.request("/ring/link/callback?state=bogus&code=x");
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("LINK_STATE_INVALID");
  });
});

describe("DELETE /households/:id", () => {
  it("removes tokens, consents and events", async () => {
    storage.upsertHousehold({
      id: "h1",
      ringAccountId: "acct-1",
      accessToken: "a",
      refreshToken: "r",
      accessTokenExpiresAt: 1,
      linkedAt: 1,
      revokedAt: null,
    });
    const a = app();
    await a.request("/ring/webhook", {
      method: "POST",
      body,
      headers: { "X-Signature": signWebhookBody(body, "hmac-key") },
    });
    expect(storage.listEvents()).toHaveLength(1);
    const r = await a.request("/households/h1", { method: "DELETE" });
    expect(r.status).toBe(200);
    expect(storage.getHouseholdByRingAccount("acct-1")).toBeNull();
    expect(storage.listEvents()).toHaveLength(0);
  });
});
