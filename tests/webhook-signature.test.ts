import { describe, expect, it } from "vitest";
import { computeWebhookDigest, verifyWebhookSignature } from "../src/ring/webhook-signature.js";

const key = "test-hmac-key";
const body = JSON.stringify({ event: "package_detected", device_id: "d1", ts: 1726300000 });

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const sig = computeWebhookDigest(body, key);
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, key })).toEqual({ ok: true });
  });

  it("accepts a prefixed signature when the prefix is configured", () => {
    const sig = `sha256=${computeWebhookDigest(body, key)}`;
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, key, prefix: "sha256=" })).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const sig = computeWebhookDigest(body, key);
    const tampered = body.replace("d1", "d2");
    const r = verifyWebhookSignature({ rawBody: tampered, signature: sig, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("rejects a missing signature with a typed code", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: undefined, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MISSING");
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const r = verifyWebhookSignature({ rawBody: body, signature: "abcd", key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WEBHOOK_SIGNATURE_MALFORMED");
  });

  it("supports base64 digests", () => {
    const sig = computeWebhookDigest(body, key, "sha256", "base64");
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, key, encoding: "base64" })).toEqual({ ok: true });
  });
});
