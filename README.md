# AgentPOS Doorstep

**When an AI agent buys from a store and the package reaches the door, the Ring doorbell's
package event closes the order's signed receipt: proof of delivery anyone can verify, with
the household's consent and without video.**

It connects the living room (Alexa+), the front door (Ring) and the cloud (AgentPOS).

> Status: early development for the Amazon "Build, Ship, Shape" Developer Hackathon 2026
> (Ring track, AWS Builder and Open Source mini challenges). Public from the first commit.
> Project name is provisional.

## What it does

1. A household links its Ring account once (Ring one-way account linking) and chooses which
   merchants or orders may receive delivery confirmation. Consent is per merchant and
   revocable. No video is ever accessed or stored.
2. Orders arrive from [AgentPOS](https://agentposhq.com) stores with their signed receipt and
   an expected delivery window.
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

## What we deliberately did not build

Motion alerts and live view, video of any kind, another package-detection app, and an
elder-care routine app (Routines by Density already covers that in the Ring Appstore). Here
the package event is not the product; it is one more signature in a chain of commerce
evidence.

## Layout

```
src/ring/        account linking, HMAC verification of webhooks, event normalization, event history
src/orders/      orders imported from AgentPOS stores with expected delivery windows
src/matching/    deterministic rules (the floor) and the context agent (Bedrock, only for ambiguity)
src/attest/      Ed25519 attestation (@stellar/stellar-sdk) and receipt-chain hand-off (@agentpos/receipts)
src/disputes/    exportable evidence pack
src/notify/      household and merchant notifications
src/usage/       usage_events (tokens, latency, model, cost per call)
src/web/         minimal panels: household (link Ring, consents) and merchant (deliveries, disputes)
tests/
docs/            architecture, security and privacy, AWS integration, friction log, costs
```

## Run

Requirements: Node >= 22.5 (uses `node:sqlite`, no native dependencies), pnpm 11+.

```bash
pnpm install
pnpm typecheck
pnpm test
```

Environment variables are listed in `.env.example`. Ring's sandbox provides synthetic devices
and events; no physical device is required. Ring currently supports devices located in the
US only.

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
