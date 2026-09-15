# CLAUDE.md, AgentPOS Doorstep

Instructions for Claude Code (and any AI coding agent) working in this repository.

## What we are building

Verifiable proof of delivery for agentic commerce: the Ring doorbell's package event, with the
household's consent, closes the signed receipt of an order an agent bought from an AgentPOS
store. Read `README.md` and `docs/ARCHITECTURE.md` first. Ring track of the Amazon "Build,
Ship, Shape" hackathon 2026, plus AWS Builder and Open Source mini challenges.

## Hard rules

1. **No video, ever.** Only event metadata (type, device, time, classification, event id).
   Optionally the hash of a snapshot Ring already stores, if the household enables it. Never
   fetch, store or forward frames or clips.
2. **Consent first.** No order is matched for a household that has not linked Ring and
   authorized that merchant or that order. Consent is revocable and revocation is immediate.
3. **Rules set the floor; the agent only resolves ambiguity.** `delivered` requires a real
   event inside the window. The agent can downgrade or explain; it can never promote a case
   without an event.
4. **Attestations are signed with a key that holds no funds**, via `@stellar/stellar-sdk`
   (Ed25519). Verification is a pure function over JSON. No home-made cryptography.
5. **Ring at runtime.** Account linking, HMAC-verified webhooks and event history are real
   calls to Ring's API (sandbox with synthetic devices during development). Mentioning Ring in
   the README does not count.
6. **Zero custody, zero commission.** Doorstep never touches money. The merchant pays a flat
   add-on; the household pays nothing.
7. **No legal claims.** Say "independent evidence"; acceptance in a chargeback depends on the
   issuer and the network.
8. **Ring Appstore content policy** is a design constraint: no surveillance of individuals,
   no recognition, no cross-property tracking, full deletion on request.
9. No secrets in the repo. `.env.example` always current.
10. **The household is the first user.** The same attestation serves the buyer (refund,
    theft report) even if no merchant pays. Never design a flow that only works for the
    merchant.
11. **Any store, AgentPOS as reference.** Orders arrive through a generic webhook (Shopify,
    WooCommerce, manual) or from AgentPOS with its signed receipt. An order without a receipt
    gets an attestation that references the order id; the docs distinguish both. Email
    parsing is out of scope.
12. **Outward actions need a human click.** The dispute agent drafts the chargeback response
    or refund request from the evidence pack and submits it (Stripe disputes API in test
    mode) only after the merchant confirms in the panel. It says "independent evidence",
    never predicts the outcome.

## Stack

TypeScript strict, Node >= 22.13 (`node:sqlite` unflagged), pnpm, Hono, `node:sqlite` behind
a storage adapter (one command to run, no services to create), vitest. Dependencies from AgentPOS
(`@agentpos/receipts`, `@agentpos/core`) come from npm once published (12 Oct 2026); before
that, a local `pnpm link` or tarball. Never copy code from the AgentPOS monorepo; import it.
AWS: Amazon Bedrock (Nova 2 Lite for simple cases, Claude Sonnet via Bedrock for ambiguous
ones), Bedrock AgentCore Runtime with Strands Agents SDK for the matching agent, AWS Lambda
and API Gateway (or App Runner) for webhook ingest, Amazon EventBridge Scheduler to close
expired windows. Region us-east-1. Document every service with file paths in
`docs/AWS-INTEGRATION.md`.

## Conventions

- Code, identifiers, comments, commits, docs: English. Conventional commits.
- Errors are typed with a machine-readable code: `{ code, message, hint }`.
- Every model call records input tokens, output tokens, latency, model and estimated cost in
  `usage_events` (SQLite), exportable to CSV.
- Every obstacle with Ring, AgentCore, Strands or Bedrock gets a same-day entry in
  `docs/FRICTION-LOG.md`.
- Synthetic households, orders and events in development, tests and the demo video. The
  only exception is the pilot: up to two US households that signed the consent form in
  `docs/SECURITY.md` ("Pilot households"), added as Ring staging users, hashed address,
  deleted at the end of the hackathon, never shown in the video or the repo.
- Ring facts come from the API reference, not from memory: header `X-Signature`,
  `sha256=<hex>` over the raw body, payload `{ meta: { request_id, account_id }, data: { id,
  type, attributes: { sub_type } } }`, OAuth PKCE with scope `ava.v1:read`. Drop
  `thumbnail_url` and `bounding_box` at parse time.
- Everything the Ring console asks for lives in `docs/RING-APPLICATION.md`; keep it current.
- No em dashes in any generated text.

## Build order

External clocks start on day one: the Ring identity verification and app creation (blocks
certification) and the search for the two pilot households (blocks week 4).

1. Ring developer account approved; account linking and HMAC-verified webhooks receiving
   synthetic package and doorbell events. Code is in place (`src/ring`, `src/web`,
   `src/storage`); pending: credentials from the console and a run against the Playground.
2. Order model with expected delivery window; generic order webhook plus import from AgentPOS
   (webhook or merchant API).
3. Deterministic matcher with rule-based confidence; window expiry job.
4. Matching agent on Bedrock for ambiguous cases only, with one-sentence explanations.
5. Signed attestation and `order.delivered` / `delivery.missing` hand-off to the receipt chain;
   offline verification.
6. Dispute pack export, minimal panels, `usage_events`, tests, README, diagram.
7. Dispute agent (draft plus confirmed submission), Ring certification submission, pilot
   households, demo video under three minutes, challenges section with numbers from
   `usage_events`.

## Relationship with other repositories

- **AgentPOS monorepo** (`NovaCorpAI/agentpos`, public from 12 Oct 2026): source of orders
  and receipts; destination of the pull request that adds `order.delivered` with third-party
  attestation to `packages/receipts/SPEC.md`.
- **agentpos-alexa**: the Alexa+ add-on where the demo order is bought.

## Definition of done per feature

Works against the Ring sandbox; has a test; records `usage_events`; documented in the README;
can be shown in 20 seconds of video.
