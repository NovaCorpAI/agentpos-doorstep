/**
 * HMAC verification for Ring webhooks.
 *
 * Ring signs every webhook delivery with the per-app HMAC Signature Key issued once in the
 * Ring Developer Console. Per the Ring Partner API reference: header `X-Signature`,
 * HMAC-SHA256 over the raw body bytes, hex digest with a `sha256=` prefix. The comparison
 * runs in constant time and anything missing, malformed or invalid is dropped before the
 * body is parsed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const RING_SIGNATURE_HEADER = "X-Signature";
export const RING_SIGNATURE_PREFIX = "sha256=";

export type HmacEncoding = "hex" | "base64";

export interface VerifyWebhookInput {
  /** Raw request body, exactly as received (bytes, not re-serialized JSON). */
  rawBody: Uint8Array | string;
  /** Signature value taken from the `X-Signature` header. */
  signature: string | undefined | null;
  /** Per-app HMAC Signature Key from the Ring Developer Console. */
  key: string;
  algorithm?: "sha256" | "sha512";
  encoding?: HmacEncoding;
  /** Prefix Ring puts in front of the digest. Defaults to `sha256=`; pass "" for none. */
  prefix?: string;
}

export type VerifyWebhookResult =
  | { ok: true }
  | {
      ok: false;
      code: "WEBHOOK_SIGNATURE_MISSING" | "WEBHOOK_SIGNATURE_MALFORMED" | "WEBHOOK_SIGNATURE_INVALID";
      hint: string;
    };

export function computeWebhookDigest(
  rawBody: Uint8Array | string,
  key: string,
  algorithm: "sha256" | "sha512" = "sha256",
  encoding: HmacEncoding = "hex",
): string {
  return createHmac(algorithm, key).update(rawBody).digest(encoding);
}

/** The exact header value Ring would send for this body: `sha256=<hex>`. Useful for tests and simulators. */
export function signWebhookBody(rawBody: Uint8Array | string, key: string): string {
  return `${RING_SIGNATURE_PREFIX}${computeWebhookDigest(rawBody, key)}`;
}

export function verifyWebhookSignature(input: VerifyWebhookInput): VerifyWebhookResult {
  const algorithm = input.algorithm ?? "sha256";
  const encoding = input.encoding ?? "hex";
  const prefix = input.prefix ?? RING_SIGNATURE_PREFIX;
  if (!input.signature) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_MISSING",
      hint: `Ring sends the digest in the ${RING_SIGNATURE_HEADER} header. Check the webhook URL configured in the console and that RING_WEBHOOK_HMAC_KEY is set.`,
    };
  }
  let presented = input.signature.trim();
  if (prefix !== "") {
    if (!presented.startsWith(prefix)) {
      return { ok: false, code: "WEBHOOK_SIGNATURE_MALFORMED", hint: `Signature must start with "${prefix}".` };
    }
    presented = presented.slice(prefix.length);
  }
  const expected = computeWebhookDigest(input.rawBody, input.key, algorithm, encoding);
  // Buffer.from does not throw on bad input; it decodes what it can. The length check
  // below catches truncated or non-hex input, and timingSafeEqual catches the rest.
  const a = Buffer.from(presented, encoding);
  const b = Buffer.from(expected, encoding);
  if (a.length === 0 || a.length !== b.length) {
    return { ok: false, code: "WEBHOOK_SIGNATURE_MALFORMED", hint: `Signature is not a valid ${encoding} ${algorithm} digest.` };
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
