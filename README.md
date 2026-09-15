# AgentPOS Doorstep

**When an AI agent buys from a store and the package reaches the door, the Ring doorbell's
package event closes the order's signed receipt: proof of delivery anyone can verify, with
the household's consent and without video.**

It connects the living room (Alexa+), the front door (Ring) and the cloud (AgentPOS).

The household is the first user: the same attestation is the buyer's proof for a refund or a
porch theft report, whether or not the store pays for anything. Porch theft is a mass problem
in the United States; estimates for 2025 range from about 100 million to about 230 million
stolen packages depending on the survey, with roughly one household in three affected
([Security.org](https://www.security.org/package-theft/annual-report/),
[Omnisend](https://www.omnisend.com/porch-pirates/)). Nobody has independent, verifiable
proof of what happened at the door. That is the gap.

> Status: early development for the Amazon "Build, Ship, Shape" Developer Hackathon 2026
> (Ring track, AWS Builder and Open Source mini challenges). Public from the first commit.
> Project name is provisional.

## What it does

1. A household links its Ring account once (Ring one-way account linking) and chooses which
   merchants or orders may receive delivery confirmation. Consent is per merchant and
   revocable. No video is ever accessed or stored.
2. Orders arrive from any store through a generic order webhook (Shopify, WooCommerce,
   manual entry) with an expected delivery window. [AgentPOS](https://agentposhq.com) is the
   reference integration: its orders also carry a signed receipt the attestation chains to.
3. **Deterministic matching first.** A package or human event on one of the household's Ring
   devices inside the window, with no competing open order, becomes `delivered`. A window
   that expires without an event becomes `missing`, and both sides are told.
4. **An agent only for ambiguity.** Two open orders and one package, an event minutes outside
   the window, a doorbell press without a package: an agent on Amazon Bedrock AgentCore decides
   `delivered`, `uncertain` or `missing` and explains why in one sentence. It can never promote
   a case that has no event.
5. **A signed attestation** (Ed25519) referencing the merchant's receipt and the hash of the
   Ring event goes to the merchant, whose receipt chain appends `order.delivered`. Anyone can
   verify receipt plus attestation offline with the JSON and public keys.
6. **Dispute pack**: order, on-chain payment hash, window, Ring event metadata, attestation
   and verified chain, exported from the merchant panel as independent evidence.
7. **Dispute agent**: drafts the chargeback response or refund request from the pack and
   submits it only after the merchant confirms in the panel. The flow ends in something that
   happened, not in a PDF.

## What we deliberately did not build

Motion alerts and live view, video of any kind, another package-detection app, and an
elder-care routine app (Routines by Density already covers that in the Ring Appstore). Here
the package event is not the product; it is one more signature in a chain of commerce
evidence.

## Layout

```
src/ring/        account linking (OAuth PKCE, nonce), HMAC verification of webhooks, event normalization, API client
src/storage/     storage adapter; node:sqlite implementation (households, consents, events, usage_events)
src/web/         Hono app: webhook, account linking, deletion endpoint
src/config.ts    environment
src/errors.ts    typed errors { code, message, hint }
tests/
docs/            architecture, security and privacy, AWS integration, friction log, costs, Ring application kit

Planned (build order in CLAUDE.md):
src/orders/      generic order webhook and AgentPOS import, expected delivery windows
src/matching/    deterministic rules (the floor) and the context agent (Bedrock, only for ambiguity)
src/attest/      Ed25519 attestation (@stellar/stellar-sdk) and receipt-chain hand-off (@agentpos/receipts)
src/disputes/    exportable evidence pack and the dispute agent
src/notify/      household and merchant notifications
```

## Run

Requirements: Node >= 22.13 (uses `node:sqlite`, no native dependencies), pnpm 11+.

```bash
pnpm install
pnpm typecheck
pnpm test
cp .env.example .env   # fill RING_* from the Ring Developer Console
pnpm dev               # http://localhost:3000
```

Endpoints: `GET /health`, `POST /ring/webhook` (HMAC verified, idempotent), `GET
/ring/link/start`, `GET /ring/link/callback`, `GET /ring/events`, `DELETE /households/:id`.

Send yourself a signed synthetic package event:

```bash
BODY='{"meta":{"request_id":"r1","account_id":"acct-1","timestamp":1760000000},"data":{"id":"e1","type":"motion_detected","attributes":{"sub_type":"package","source":"dev-1"}}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RING_WEBHOOK_HMAC_KEY" | sed 's/^.* //')"
curl -X POST http://localhost:3000/ring/webhook -H "X-Signature: $SIG" -d "$BODY"
```

Environment variables are listed in `.env.example`. Ring's Developers Playground simulates
Package, Vehicle and Motion events; Ring supports devices located in the US only. What the
Ring console asks for, and the draft answers, are in `docs/RING-APPLICATION.md`.

## Privacy, in one paragraph

Only event metadata, never video or snapshots. Explicit, revocable consent per merchant or
order. Hashed addresses. Full deletion on request. Data stays in the US. Built to comply with
the Ring Appstore content policy: no surveillance of individuals, no recognition, no
cross-property tracking.

## Relationship with AgentPOS

Doorstep consumes what AgentPOS stores already emit (orders, signed receipts) and proposes
`order.delivered` and `delivery.missing` receipt events with third-party attestation to the
AgentPOS receipt specification. The sibling project
[agentpos-alexa](https://github.com/NovaCorpAI/agentpos-alexa) is where the order gets bought.

## License

Apache-2.0. Copyright 2026 NovaCorpAI SpA.
