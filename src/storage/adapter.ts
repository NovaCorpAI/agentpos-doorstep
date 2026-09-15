/**
 * Storage adapter. `node:sqlite` implements it for local runs; a Postgres implementation
 * can replace it for the hosted tier without touching the domain modules.
 *
 * Nothing here stores video, snapshots, thumbnails or frames. Only event metadata.
 */

export interface HouseholdRecord {
  id: string;
  /** Ring account id from GET /v1/users/me. */
  ringAccountId: string;
  accessToken: string;
  refreshToken: string;
  /** Unix ms when the access token expires. */
  accessTokenExpiresAt: number;
  linkedAt: number;
  /** Set when the household unlinks Ring or asks for deletion; matching stops immediately. */
  revokedAt: number | null;
}

export type ConsentScope = { kind: "merchant"; merchantId: string } | { kind: "order"; orderId: string };

export interface ConsentRecord {
  id: string;
  householdId: string;
  scope: ConsentScope;
  grantedAt: number;
  revokedAt: number | null;
}

/** Classification derived from the Ring event, the only vocabulary the matcher uses. */
export type EventClassification = "package" | "human" | "doorbell" | "motion" | "other";

export interface EventRecord {
  /** Ring event id (`data.id`). */
  id: string;
  /** Ring delivery id (`meta.request_id`), used for idempotency. */
  requestId: string;
  ringAccountId: string | null;
  deviceId: string | null;
  type: string;
  subType: string | null;
  classification: EventClassification;
  /** Unix ms when the event occurred on the device. */
  occurredAt: number;
  /** Unix ms when the webhook was received. */
  receivedAt: number;
  /** SHA-256 hex of the raw webhook body, referenced by the attestation. */
  bodyHash: string;
}

export interface UsageEvent {
  id: string;
  at: number;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  /** Order, event or match this call was about, if any. */
  subjectId: string | null;
}

export interface EventFilter {
  ringAccountId?: string;
  since?: number;
  until?: number;
}

export interface Storage {
  upsertHousehold(h: HouseholdRecord): void;
  getHouseholdByRingAccount(ringAccountId: string): HouseholdRecord | null;
  revokeHousehold(id: string, at: number): void;

  grantConsent(c: ConsentRecord): void;
  revokeConsent(id: string, at: number): void;
  listActiveConsents(householdId: string): ConsentRecord[];

  /** Returns false when an event with the same request id was already stored. */
  insertEvent(e: EventRecord): boolean;
  listEvents(filter?: EventFilter): EventRecord[];

  recordUsage(u: UsageEvent): void;
  listUsage(): UsageEvent[];

  /** Full deletion for a household: tokens, consents and events. */
  deleteHouseholdData(householdId: string): void;

  close(): void;
}
