import { describe, expect, it } from "vitest";
import { classify, hashBody, parseRingEvent, toUnixMs } from "../src/ring/events.js";

const received = 1_760_000_000_000;

function payload(overrides: Record<string, unknown> = {}, attributes: Record<string, unknown> = {}) {
  return JSON.stringify({
    meta: { request_id: "req-1", account_id: "ava1.ring.account.ABC", timestamp: 1_759_999_000, version: "1" },
    data: {
      id: "evt-1",
      type: "motion_detected",
      attributes: { sub_type: "package", source: "device-9", timestamp: 1_759_999_000, ...attributes },
      ...overrides,
    },
  });
}

describe("parseRingEvent", () => {
  it("normalizes a package event and keeps only metadata", () => {
    const raw = payload({}, { thumbnail_url: "https://example/frame.jpg", bounding_box: { x: 1, y: 2, width: 3, height: 4 } });
    const r = parseRingEvent(raw, received);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event).toEqual({
      id: "evt-1",
      requestId: "req-1",
      ringAccountId: "ava1.ring.account.ABC",
      deviceId: "device-9",
      type: "motion_detected",
      subType: "package",
      classification: "package",
      occurredAt: 1_759_999_000_000,
      receivedAt: received,
      bodyHash: hashBody(raw),
    });
    expect(JSON.stringify(r.event)).not.toContain("thumbnail");
    expect(JSON.stringify(r.event)).not.toContain("bounding");
  });

  it("classifies doorbell presses and humans", () => {
    expect(classify("button_press", null)).toBe("doorbell");
    expect(classify("motion_detected", "human")).toBe("human");
    expect(classify("person_detected", null)).toBe("human");
    expect(classify("motion_detected", "vehicle")).toBe("motion");
    expect(classify("device_added", null)).toBe("other");
  });

  it("finds the device id in relationships when attributes.source is absent", () => {
    const raw = payload(
      { relationships: { devices: { links: { self: "https://api.amazonvision.com/v1/devices/dev-42" } } } },
      { source: undefined },
    );
    const r = parseRingEvent(raw, received);
    expect(r.ok && r.event.deviceId).toBe("dev-42");
  });

  it("falls back to meta timestamp, then to received time", () => {
    const noAttrTs = parseRingEvent(payload({}, { timestamp: undefined }), received);
    expect(noAttrTs.ok && noAttrTs.event.occurredAt).toBe(1_759_999_000_000);
    const none = parseRingEvent(
      JSON.stringify({ meta: { request_id: "r" }, data: { id: "e", type: "button_press" } }),
      received,
    );
    expect(none.ok && none.event.occurredAt).toBe(received);
  });

  it("rejects non-JSON and incomplete payloads with a typed code", () => {
    const bad = parseRingEvent("not json", received);
    expect(bad.ok).toBe(false);
    const incomplete = parseRingEvent(JSON.stringify({ meta: {}, data: { id: "e" } }), received);
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.code).toBe("WEBHOOK_PAYLOAD_INVALID");
  });
});

describe("toUnixMs", () => {
  it("accepts seconds, milliseconds and ISO strings", () => {
    expect(toUnixMs(1_759_999_000)).toBe(1_759_999_000_000);
    expect(toUnixMs(1_759_999_000_123)).toBe(1_759_999_000_123);
    expect(toUnixMs("2026-10-09T08:30:00Z")).toBe(Date.parse("2026-10-09T08:30:00Z"));
    expect(toUnixMs("nope")).toBeNull();
  });
});
