/**
 * Ring webhook payloads (JSON:API shape) normalized into the event metadata Doorstep keeps.
 *
 * Kept: event id, delivery id, account id, device id, type, sub_type, timestamps and the
 * SHA-256 of the raw body. Dropped on purpose: `thumbnail_url`, `bounding_box` and anything
 * else that points at or describes an image. Hard rule 1: no video, no frames, ever.
 *
 * Shape observed in Ring's reference and the official hello-world sample:
 *   { meta: { request_id, account_id?, timestamp? | time?, version? },
 *     data: { id, type, attributes: { sub_type?, source?, timestamp?, component_ids? },
 *             relationships?: { devices?: { data?: [{ id }] , links?: { self } } } } }
 */
import { createHash } from "node:crypto";
import type { EventClassification, EventRecord } from "../storage/adapter.js";

/** Webhook `data.type` values published by Ring. Anything else is stored as `other`. */
export const RING_EVENT_TYPES = [
  "motion_detected",
  "button_press",
  "person_detected",
  "device_added",
  "device_removed",
  "device_online",
  "device_offline",
  "app_integration_added",
  "app_integration_removed",
  "subscription_activated",
  "subscription_deactivated",
] as const;

export type RingEventType = (typeof RING_EVENT_TYPES)[number];

export type ParseRingEventResult =
  | { ok: true; event: EventRecord }
  | { ok: false; code: "WEBHOOK_PAYLOAD_INVALID"; hint: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Accepts unix seconds, unix ms or ISO 8601. Returns unix ms or null. */
export function toUnixMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v < 1e11 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return toUnixMs(Number(v));
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export function classify(type: string, subType: string | null): EventClassification {
  if (type === "button_press") return "doorbell";
  if (type === "person_detected") return "human";
  if (type === "motion_detected") {
    const s = subType?.toLowerCase() ?? "";
    if (s.includes("package")) return "package";
    if (s === "human" || s === "person") return "human";
    return "motion";
  }
  return "other";
}

/** SHA-256 hex of the raw body, the value an attestation references. */
export function hashBody(rawBody: Uint8Array | string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parseRingEvent(
  rawBody: Uint8Array | string,
  receivedAt: number = Date.now(),
): ParseRingEventResult {
  let json: unknown;
  try {
    json = JSON.parse(typeof rawBody === "string" ? rawBody : Buffer.from(rawBody).toString("utf8"));
  } catch {
    return { ok: false, code: "WEBHOOK_PAYLOAD_INVALID", hint: "Body is not JSON." };
  }
  if (!isRecord(json) || !isRecord(json.meta) || !isRecord(json.data)) {
    return { ok: false, code: "WEBHOOK_PAYLOAD_INVALID", hint: "Expected { meta, data } (JSON:API)." };
  }
  const { meta, data } = json;
  const requestId = str(meta.request_id);
  const id = str(data.id);
  const type = str(data.type);
  if (!requestId || !id || !type) {
    return {
      ok: false,
      code: "WEBHOOK_PAYLOAD_INVALID",
      hint: "meta.request_id, data.id and data.type are required.",
    };
  }
  const attributes = isRecord(data.attributes) ? data.attributes : {};
  const subType = str(attributes.sub_type);

  let deviceId = str(attributes.source);
  if (!deviceId && isRecord(data.relationships) && isRecord(data.relationships.devices)) {
    const devices = data.relationships.devices;
    const first = Array.isArray(devices.data) ? devices.data[0] : devices.data;
    if (isRecord(first)) deviceId = str(first.id);
    if (!deviceId && isRecord(devices.links)) {
      const self = str(devices.links.self);
      const m = self?.match(/\/devices\/([^/?#]+)/);
      deviceId = m?.[1] ?? null;
    }
  }

  const occurredAt =
    toUnixMs(attributes.timestamp) ?? toUnixMs(meta.timestamp) ?? toUnixMs(meta.time) ?? receivedAt;

  return {
    ok: true,
    event: {
      id,
      requestId,
      ringAccountId: str(meta.account_id),
      deviceId,
      type,
      subType,
      classification: classify(type, subType),
      occurredAt,
      receivedAt,
      bodyHash: hashBody(rawBody),
    },
  };
}
