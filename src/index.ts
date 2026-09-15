/**
 * AgentPOS Doorstep: verifiable proof of delivery for agentic commerce.
 *
 * Modules (see CLAUDE.md, "Build order"):
 *   ring/      account linking, HMAC-verified webhooks, event normalization, event history
 *   storage/   adapter (node:sqlite locally) for households, consents, events, usage_events
 *   web/       Hono app: webhook, account linking, deletion
 *   orders/    orders from AgentPOS stores and generic sources with expected delivery windows (planned)
 *   matching/  deterministic rules (floor) and the context agent (Bedrock, ambiguity only) (planned)
 *   attest/    Ed25519 attestation and receipt-chain hand-off (planned)
 *   disputes/  exportable evidence pack (planned)
 */
export { loadConfig, RING_DEFAULTS } from "./config.js";
export type { Config } from "./config.js";
export { DoorstepError } from "./errors.js";
export type { Result, TypedError } from "./errors.js";
export { RingClient } from "./ring/client.js";
export { classify, hashBody, parseRingEvent, RING_EVENT_TYPES, toUnixMs } from "./ring/events.js";
export { computeNonce, NONCE_WINDOW_SECONDS, verifyNonce } from "./ring/nonce.js";
export { buildAuthorizeUrl, createPkce, createState, exchangeCode, refreshTokens, RING_SCOPE } from "./ring/oauth.js";
export {
  computeWebhookDigest,
  RING_SIGNATURE_HEADER,
  RING_SIGNATURE_PREFIX,
  signWebhookBody,
  verifyWebhookSignature,
} from "./ring/webhook-signature.js";
export type { VerifyWebhookInput, VerifyWebhookResult } from "./ring/webhook-signature.js";
export { SqliteStorage } from "./storage/sqlite.js";
export type * from "./storage/adapter.js";
export { createApp } from "./web/app.js";

export const DOORSTEP_VERSION = "0.0.1";

/** Outcome vocabulary shared by rules, agent, attestation and receipt events. */
export type DeliveryOutcome = "delivered" | "uncertain" | "missing";

/** Which layer produced an outcome. The agent can never be the origin of a `delivered` without an event. */
export type OutcomeOrigin = "rule" | "agent";
