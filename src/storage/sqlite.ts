/**
 * `node:sqlite` implementation of the storage adapter. One file, no services to create.
 * Node >= 22.13 ships `node:sqlite` without a flag.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  ConsentRecord,
  ConsentScope,
  EventFilter,
  EventRecord,
  HouseholdRecord,
  Storage,
  UsageEvent,
} from "./adapter.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  ring_account_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at INTEGER NOT NULL,
  linked_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  scope_kind TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  ring_account_id TEXT,
  device_id TEXT,
  type TEXT NOT NULL,
  sub_type TEXT,
  classification TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  body_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_account_time ON events(ring_account_id, occurred_at);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL,
  subject_id TEXT
);
`;

type Row = Record<string, string | number | null>;

function scopeOf(row: Row): ConsentScope {
  return row.scope_kind === "merchant"
    ? { kind: "merchant", merchantId: String(row.scope_id) }
    : { kind: "order", orderId: String(row.scope_id) };
}

function toHousehold(r: Row): HouseholdRecord {
  return {
    id: String(r.id),
    ringAccountId: String(r.ring_account_id),
    accessToken: String(r.access_token),
    refreshToken: String(r.refresh_token),
    accessTokenExpiresAt: Number(r.access_token_expires_at),
    linkedAt: Number(r.linked_at),
    revokedAt: r.revoked_at === null ? null : Number(r.revoked_at),
  };
}

function toEvent(r: Row): EventRecord {
  return {
    id: String(r.id),
    requestId: String(r.request_id),
    ringAccountId: r.ring_account_id === null ? null : String(r.ring_account_id),
    deviceId: r.device_id === null ? null : String(r.device_id),
    type: String(r.type),
    subType: r.sub_type === null ? null : String(r.sub_type),
    classification: String(r.classification) as EventRecord["classification"],
    occurredAt: Number(r.occurred_at),
    receivedAt: Number(r.received_at),
    bodyHash: String(r.body_hash),
  };
}

export class SqliteStorage implements Storage {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
  }

  upsertHousehold(h: HouseholdRecord): void {
    this.db
      .prepare(
        `INSERT INTO households (id, ring_account_id, access_token, refresh_token, access_token_expires_at, linked_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(ring_account_id) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           access_token_expires_at = excluded.access_token_expires_at,
           linked_at = excluded.linked_at,
           revoked_at = excluded.revoked_at`,
      )
      .run(h.id, h.ringAccountId, h.accessToken, h.refreshToken, h.accessTokenExpiresAt, h.linkedAt, h.revokedAt);
  }

  getHouseholdByRingAccount(ringAccountId: string): HouseholdRecord | null {
    const r = this.db.prepare("SELECT * FROM households WHERE ring_account_id = ?").get(ringAccountId) as
      | Row
      | undefined;
    return r ? toHousehold(r) : null;
  }

  revokeHousehold(id: string, at: number): void {
    this.db
      .prepare("UPDATE households SET revoked_at = ?, access_token = '', refresh_token = '' WHERE id = ?")
      .run(at, id);
  }

  grantConsent(c: ConsentRecord): void {
    const scopeId = c.scope.kind === "merchant" ? c.scope.merchantId : c.scope.orderId;
    this.db
      .prepare(
        "INSERT INTO consents (id, household_id, scope_kind, scope_id, granted_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(c.id, c.householdId, c.scope.kind, scopeId, c.grantedAt, c.revokedAt);
  }

  revokeConsent(id: string, at: number): void {
    this.db.prepare("UPDATE consents SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(at, id);
  }

  listActiveConsents(householdId: string): ConsentRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM consents WHERE household_id = ? AND revoked_at IS NULL")
      .all(householdId) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      householdId: String(r.household_id),
      scope: scopeOf(r),
      grantedAt: Number(r.granted_at),
      revokedAt: null,
    }));
  }

  insertEvent(e: EventRecord): boolean {
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO events (id, request_id, ring_account_id, device_id, type, sub_type, classification, occurred_at, received_at, body_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.id,
        e.requestId,
        e.ringAccountId,
        e.deviceId,
        e.type,
        e.subType,
        e.classification,
        e.occurredAt,
        e.receivedAt,
        e.bodyHash,
      );
    return Number(res.changes) === 1;
  }

  listEvents(filter: EventFilter = {}): EventRecord[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.ringAccountId !== undefined) {
      where.push("ring_account_id = ?");
      params.push(filter.ringAccountId);
    }
    if (filter.since !== undefined) {
      where.push("occurred_at >= ?");
      params.push(filter.since);
    }
    if (filter.until !== undefined) {
      where.push("occurred_at <= ?");
      params.push(filter.until);
    }
    const sql = `SELECT * FROM events${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY occurred_at ASC`;
    return (this.db.prepare(sql).all(...params) as Row[]).map(toEvent);
  }

  recordUsage(u: UsageEvent): void {
    this.db
      .prepare(
        `INSERT INTO usage_events (id, at, model, operation, input_tokens, output_tokens, latency_ms, estimated_cost_usd, subject_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(u.id, u.at, u.model, u.operation, u.inputTokens, u.outputTokens, u.latencyMs, u.estimatedCostUsd, u.subjectId);
  }

  listUsage(): UsageEvent[] {
    return (this.db.prepare("SELECT * FROM usage_events ORDER BY at ASC").all() as Row[]).map((r) => ({
      id: String(r.id),
      at: Number(r.at),
      model: String(r.model),
      operation: String(r.operation),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      latencyMs: Number(r.latency_ms),
      estimatedCostUsd: Number(r.estimated_cost_usd),
      subjectId: r.subject_id === null ? null : String(r.subject_id),
    }));
  }

  deleteHouseholdData(householdId: string): void {
    const h = this.db.prepare("SELECT ring_account_id FROM households WHERE id = ?").get(householdId) as
      | Row
      | undefined;
    if (!h) return;
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM events WHERE ring_account_id = ?").run(String(h.ring_account_id));
      this.db.prepare("DELETE FROM consents WHERE household_id = ?").run(householdId);
      this.db.prepare("DELETE FROM households WHERE id = ?").run(householdId);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}
