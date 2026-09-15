import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteStorage } from "../src/storage/sqlite.js";
import type { EventRecord, HouseholdRecord } from "../src/storage/adapter.js";

let db: SqliteStorage;

const household: HouseholdRecord = {
  id: "h1",
  ringAccountId: "acct-1",
  accessToken: "at",
  refreshToken: "rt",
  accessTokenExpiresAt: 2_000,
  linkedAt: 1_000,
  revokedAt: null,
};

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "evt-1",
    requestId: "req-1",
    ringAccountId: "acct-1",
    deviceId: "dev-1",
    type: "motion_detected",
    subType: "package",
    classification: "package",
    occurredAt: 5_000,
    receivedAt: 5_100,
    bodyHash: "ab".repeat(32),
    ...overrides,
  };
}

beforeEach(() => {
  db = new SqliteStorage(":memory:");
});
afterEach(() => db.close());

describe("SqliteStorage", () => {
  it("upserts households by Ring account and reads them back", () => {
    db.upsertHousehold(household);
    db.upsertHousehold({ ...household, accessToken: "at2" });
    expect(db.getHouseholdByRingAccount("acct-1")?.accessToken).toBe("at2");
    expect(db.getHouseholdByRingAccount("nope")).toBeNull();
  });

  it("stores events once per request id", () => {
    expect(db.insertEvent(event())).toBe(true);
    expect(db.insertEvent(event({ id: "evt-2" }))).toBe(false);
    expect(db.listEvents()).toHaveLength(1);
  });

  it("filters events by account and time", () => {
    db.insertEvent(event());
    db.insertEvent(event({ id: "e2", requestId: "r2", occurredAt: 9_000 }));
    db.insertEvent(event({ id: "e3", requestId: "r3", ringAccountId: "acct-2" }));
    expect(db.listEvents({ ringAccountId: "acct-1", since: 6_000 }).map((e) => e.id)).toEqual(["e2"]);
    expect(db.listEvents({ until: 6_000 }).map((e) => e.id).sort()).toEqual(["e3", "evt-1"]);
  });

  it("tracks consents and revocation", () => {
    db.upsertHousehold(household);
    db.grantConsent({ id: "c1", householdId: "h1", scope: { kind: "merchant", merchantId: "m1" }, grantedAt: 1, revokedAt: null });
    db.grantConsent({ id: "c2", householdId: "h1", scope: { kind: "order", orderId: "o1" }, grantedAt: 1, revokedAt: null });
    expect(db.listActiveConsents("h1")).toHaveLength(2);
    db.revokeConsent("c1", 2);
    expect(db.listActiveConsents("h1").map((c) => c.id)).toEqual(["c2"]);
  });

  it("revocation wipes tokens immediately", () => {
    db.upsertHousehold(household);
    db.revokeHousehold("h1", 3);
    const h = db.getHouseholdByRingAccount("acct-1");
    expect(h?.revokedAt).toBe(3);
    expect(h?.accessToken).toBe("");
  });

  it("deletes everything for a household on request", () => {
    db.upsertHousehold(household);
    db.grantConsent({ id: "c1", householdId: "h1", scope: { kind: "merchant", merchantId: "m1" }, grantedAt: 1, revokedAt: null });
    db.insertEvent(event());
    db.deleteHouseholdData("h1");
    expect(db.getHouseholdByRingAccount("acct-1")).toBeNull();
    expect(db.listActiveConsents("h1")).toHaveLength(0);
    expect(db.listEvents()).toHaveLength(0);
  });

  it("records usage events", () => {
    db.recordUsage({
      id: "u1",
      at: 1,
      model: "amazon.nova-2-lite-v1:0",
      operation: "match.explain",
      inputTokens: 120,
      outputTokens: 30,
      latencyMs: 410,
      estimatedCostUsd: 0.00002,
      subjectId: "order-1",
    });
    expect(db.listUsage()).toHaveLength(1);
    expect(db.listUsage()[0]?.model).toBe("amazon.nova-2-lite-v1:0");
  });
});
