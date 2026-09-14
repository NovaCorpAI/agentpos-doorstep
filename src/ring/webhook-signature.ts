/**
 * HMAC verification for Ring webhooks.
 *
 * Ring signs webhook deliveries with an HMAC key issued per app in the Ring Developer
 * Console. The exact header name and digest encoding are taken from the Ring API reference
 * and configured by the caller; this module only does the cryptographic comparison, in
 * constant time, and refuses anything malformed. A webhook that fails verification is
 * dropped before any parsing of its body.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type HmacEncoding = "hex" | "base64";

export interface VerifyWebhookInput {
  /** Raw request body, exactly as received (bytes, not re-serialized JSON). */
  rawBody: Uint8Array | string;
  /** Signature value taken from the configured header. */
  signature: string | undefined | null;
  /** Per-app HMAC key from the Ring Developer Console. */
  key: string;
  algorithm?: "sha256" | "sha512";
  encoding?: HmacEncoding;
  /** Optional prefix Ring may put in front of the digest, e.g. "sha256=". */
  prefix?: string;
}

export type VerifyWebhookResult =
  | { ok: true }
  | { ok: false; code: "WEBHOOK_SIGNATURE_MISSING" | "WEBHOOK_SIGNATURE_MALFORMED" | "WEBHOOK_SIGNATURE_INVALID"; hint: string };

export function computeWebhookDigest(
  rawBody: Uint8Array | string,
  key: string,
  algorithm: "sha256" | "sha512" = "sha256",
  encoding: HmacEncoding = "hex",
): string {
  return createHmac(algorithm, key).update(rawBody).digest(encoding);
}

export function verifyWebhookSignature(input: VerifyWebhookInput): VerifyWebhookResult {
  const algorithm = input.algorithm ?? "sha256";
  const encoding = input.encoding ?? "hex";
  if (!input.signature) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_MISSING",
      hint: "Configure the signature header name from the Ring API reference and make sure the key is set.",
    };
  }
  let presented = input.signature.trim();
  if (input.prefix && presented.startsWith(input.prefix)) {
    presented = presented.slice(input.prefix.length);
  }
  const expected = computeWebhookDigest(input.rawBody, input.key, algorithm, encoding);
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(presented, encoding);
    b = Buffer.from(expected, encoding);
  } catch {
    return { ok: false, code: "WEBHOOK_SIGNATURE_MALFORMED", hint: `Signature is not valid ${encoding}.` };
  }
  if (a.length === 0 || a.length !== b.length) {
    return { ok: false, code: "WEBHOOK_SIGNATURE_MALFORMED", hint: "Signature length does not match the digest." };
  }
  if (!timingSafeEqual(a, b)) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_INVALID",
      hint: "Body was altered in transit or the HMAC key does not match this app.",
    };
  }
  return { ok: true };
}
