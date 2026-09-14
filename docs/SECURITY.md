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
- **Secrets only in the environment**; `.env.example` is always current.
