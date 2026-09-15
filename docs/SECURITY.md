# Security and privacy

- **Only event metadata.** Type, device, time, classification and Ring event id. Never video,
  never snapshots. Optionally the hash of a snapshot Ring already stores, if the household
  enables it.
- **Consent is the gate.** A household links Ring itself and authorizes merchants or orders.
  Revocation is immediate and stops matching for that scope.
- **Webhooks are verified before parsing.** HMAC in constant time; anything missing,
  malformed or invalid is dropped (`src/ring/webhook-signature.ts`).
- **Attestation keys hold no funds.** Ed25519 through `@stellar/stellar-sdk`; the public key
  is published; verification is a pure function over JSON with no API.
- **Addresses are hashed**; logs carry no PII; structured JSON with a `traceId`.
- **Full deletion on request**, including attestations we hold (the merchant keeps its own
  receipt chain; that is theirs).
- **Data stays in the US**, where Ring devices are supported today.
- **Ring Appstore content policy** as a design constraint: no surveillance of individuals, no
  recognition, no cross-property tracking, no covert access.
- **Ring tokens** live per household in storage, are wiped on revocation
  (`revokeHousehold`) and removed on deletion (`DELETE /households/:id`). Encrypted at rest
  in the hosted tier.
- **Secrets only in the environment**; `.env.example` is always current.

## Pilot households

Up to two US households may receive real packages during the last week, as Ring staging
users. Conditions: written consent (this text, dated and signed by an adult in the
household), hashed address only, orders are test orders, no name or address in the repo, the
video or any screenshot, and full deletion at the end of the hackathon with confirmation.
Consent text:

> I authorize NovaCorpAI SpA to receive event metadata (type, device, time) from my Ring
> account through the Doorstep staging app for the purpose of testing delivery
> confirmations, from the date below until 2026-11-30 at the latest. No video or images are
> accessed. I can revoke by removing the app from my Ring account at any time, and all data
> will be deleted on request or at the end of the test, whichever comes first.
