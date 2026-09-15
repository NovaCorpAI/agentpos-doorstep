import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeNonce, verifyNonce } from "../src/ring/nonce.js";

const key = "hmac-key";
const accountId = "ava1.ring.account.XYZ";
const time = 1_760_000_000;

describe("account-linking nonce", () => {
  it("is HMAC-SHA256 over time:account_id in base64url without padding", () => {
    const expected = createHmac("sha256", key).update(`${time}:${accountId}`).digest("base64url");
    expect(computeNonce(time, accountId, key)).toBe(expected);
    expect(computeNonce(time, accountId, key)).not.toMatch(/[+/=]/);
  });

  it("verifies inside the 600 second window", () => {
    const presented = computeNonce(time, accountId, key);
    expect(verifyNonce({ presented, time, accountId, hmacKey: key, nowSeconds: time + 599 })).toEqual({ ok: true });
  });

  it("rejects expired, mismatched and malformed nonces", () => {
    const presented = computeNonce(time, accountId, key);
    const expired = verifyNonce({ presented, time, accountId, hmacKey: key, nowSeconds: time + 601 });
    expect(!expired.ok && expired.code).toBe("NONCE_EXPIRED");
    const mismatch = verifyNonce({ presented, time, accountId: "other", hmacKey: key, nowSeconds: time });
    expect(!mismatch.ok && mismatch.code).toBe("NONCE_MISMATCH");
    const malformed = verifyNonce({ presented: "abc", time, accountId, hmacKey: key, nowSeconds: time });
    expect(!malformed.ok && malformed.code).toBe("NONCE_MALFORMED");
  });
});
