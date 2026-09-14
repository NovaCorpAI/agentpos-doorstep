/**
 * AgentPOS Doorstep: verifiable proof of delivery for agentic commerce.
 *
 * Modules (see CLAUDE.md, "Build order"):
 *   ring/      account linking, HMAC-verified webhooks, event normalization, event history
 *   orders/    orders from AgentPOS stores with expected delivery windows
 *   matching/  deterministic rules (floor) and the context agent (Bedrock, ambiguity only)
 *   attest/    Ed25519 attestation and receipt-chain hand-off
 *   disputes/  exportable evidence pack
 */
export { computeWebhookDigest, verifyWebhookSignature } from "./ring/webhook-signature.js";
export type { VerifyWebhookInput, VerifyWebhookResult } from "./ring/webhook-signature.js";

export const DOORSTEP_VERSION = "0.0.1";

/** Outcome vocabulary shared by rules, agent, attestation and receipt events. */
export type DeliveryOutcome = "delivered" | "uncertain" | "missing";

/** Which layer produced an outcome. The agent can never be the origin of a `delivered` without an event. */
export type OutcomeOrigin = "rule" | "agent";
