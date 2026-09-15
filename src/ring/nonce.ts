/**
 * Nonce for Ring one-way account linking.
 *
 * Ring computes `HMAC-SHA256(hmac_key, "<time>:<account_id>")`, URL-safe base64 without
 * padding, and the partner recomputes it for every unclaimed token to find the one that
 * belongs to the account it just fetched with GET /v1/users/me. Valid for 600 seconds.
 * Same key as webhook signatures, different encoding (hex there, base64url here).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const NONCE_WINDOW_SECONDS = 600;

export function computeNonce(time: string | number, accountId: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(`${time}:${accountId}`).digest("base64url");
}

export type VerifyNonceResult =
  | { ok: true }
  | { ok: false; code: "NONCE_EXPIRED" | "NONCE_MISMATCH" | "NONCE_MALFORMED"; hint: string };

export function verifyNonce(input: {
  presented: string;
  time: string | number;
  accountId: string;
  hmacKey: string;
  nowSeconds?: number;
}): VerifyNonceResult {
  const t = Number(input.time);
  if (!Number.isFinite(t)) {
    return { ok: false, code: "NONCE_MALFORMED", hint: "time must be unix seconds." };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > NONCE_WINDOW_SECONDS) {
    return { ok: false, code: "NONCE_EXPIRED", hint: `Nonce is older than ${NONCE_WINDOW_SECONDS} seconds.` };
  }
  const expected = Buffer.from(computeNonce(input.time, input.accountId, input.hmacKey), "base64url");
  const presented = Buffer.from(input.presented.trim(), "base64url");
  if (presented.length === 0 || presented.length !== expected.length) {
    return { ok: false, code: "NONCE_MALFORMED", hint: "Nonce is not a base64url SHA-256 digest." };
  }
  if (!timingSafeEqual(presented, expected)) {
    return { ok: false, code: "NONCE_MISMATCH", hint: "Nonce does not belong to this account or key." };
  }
  return { ok: true };
}
