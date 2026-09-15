import { describe, expect, it } from "vitest";
import { computeWebhookDigest, signWebhookBody, verifyWebhookSignature } from "../src/ring/webhook-signature.js";

const key = "test-hmac-key";
const body = JSON.stringify({ event: "package_detected", device_id: "d1", ts: 1726300000 });

describe("verifyWebhookSignature", () => {
  it("accepts the Ring format: sha256=<hex> over the raw body", () => {
    const sig = signWebhookBody(body, key);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, key })).toEqual({ ok: true });
  });

  it("accepts bytes and strings alike", () => {
    const sig = signWebhookBody(body, key);
    expect(verifyWebhookSignature({ rawBody: Buffer.from(body), signature: sig, key })).toEqual({ ok: true });
  });

  it("rejects a digest without the sha256= prefix when a prefix is expected", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: computeWebhookDigest(body, key), key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MALFORMED");
  });

  it("rejects a tampered body", () => {
    const sig = signWebhookBody(body, key);
    const tampered = body.replace("d1", "d2");
    const r = verifyWebhookSignature({ rawBody: tampered, signature: sig, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("rejects a wrong key", () => {
    const sig = signWebhookBody(body, "other-key");
    const r = verifyWebhookSignature({ rawBody: body, signature: sig, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("rejects a missing signature with a typed code", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: undefined, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MISSING");
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: "sha256=abcd", key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MALFORMED");
  });

  it("rejects non-hex garbage of the right length without throwing", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: `sha256=${"z".repeat(64)}`, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MALFORMED");
  });

  it("supports base64 digests with no prefix when configured", () => {
    const sig = computeWebhookDigest(body, key, "sha256", "base64");
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, key, encoding: "base64", prefix: "" })).toEqual({ ok: true });
  });
});
