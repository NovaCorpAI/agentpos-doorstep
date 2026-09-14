# Architecture

```
AgentPOS store  --(paid order + signed receipt, webhook)-->  src/orders
Household  --(Ring one-way account linking, OAuth 2.0)-->  Ring  --(HMAC webhooks: package, human, doorbell)-->  src/ring
                                                                                   v
                        Ingest (AWS Lambda + API Gateway, or App Runner; Node 22.5, Hono)
                                                                                   v
                        node:sqlite (adapter) | Postgres: households, consents, orders, events, matches, attestations, usage_events
                                                                                   v
                        src/matching: deterministic rules  ->  (ambiguity only)  context agent (Strands on AgentCore, Bedrock)
                        Amazon EventBridge Scheduler closes expired windows (delivery.missing)
                                                                                   v
                        src/attest: Ed25519 signature (@stellar/stellar-sdk)  ->  merchant webhook  ->  @agentpos/receipts appends order.delivered
                                                                                   v
                        src/disputes: evidence pack   |   src/web: household and merchant panels   |   src/notify
```

## Decisions

- **All-AWS for this project**: Ring is Amazon and the AWS Builder challenge rewards documented
  integrations. Lambda or App Runner for ingest, EventBridge Scheduler for window expiry,
  AgentCore for the agent, Bedrock for the models.
- **Two decision layers**: rules set the floor; the agent resolves ambiguity and explains. It
  can never promote a case without an event.
- **No video**, by thesis, by cost and by the Ring Appstore content policy.
- **Ed25519 via `@stellar/stellar-sdk`**: the same primitive AgentPOS receipts use, so one
  verifier covers both.
- **SQLite by default** so a judge runs it with one command; Postgres for the hosted tier.

## Data model

`households` (user, linked devices), `consents` (household, merchant or order, granted and
revoked timestamps), `orders` (order id, receipt id, merchant, expected window, hashed
address), `events` (type, device, time, classification, Ring event id), `matches` (order,
event, confidence, origin `rule` or `agent`, explanation), `attestations` (signed JSON,
receipt id, event hash, outcome), `usage_events`.
