# Privacy policy, AgentPOS Doorstep

Effective 2026-09-15. Controller: NovaCorpAI SpA, Chile ("we"). Contact: open an issue at
https://github.com/NovaCorpAI/agentpos-doorstep/issues or write to the address listed in the
Ring Appstore listing.

## What Doorstep does

Doorstep links your Ring account to online orders you choose, and issues a signed
attestation when a Ring package or doorbell event happens inside an order's expected
delivery window, or a missed-delivery notice when the window closes without one.

## What we collect

From Ring, with your authorization:

- Your Ring account identifier and the identifiers of the devices you granted.
- Per event: event type, sub type (for example "package"), device identifier, time, Ring
  event identifier and delivery identifier.

We never request, receive, store or forward video, live view, clips, snapshots, thumbnails
or bounding boxes. Doorstep only asks Ring for the "Cameras and Doorbells" event scope and
discards any media reference at the moment a webhook is parsed.

From stores you authorize: order identifier, store identifier, expected delivery window and
a hash of the delivery address. We do not store the plain address.

Operational data: server logs with a trace identifier and error codes, without personal
data. Model usage records (tokens, latency, cost) that reference an order identifier only.

## How we use it

- To match events to orders and produce attestations and missed-delivery notices.
- To notify you and the store you authorized.
- To let you export an evidence pack for a refund, chargeback or theft report.

We do not use your data for advertising, profiling, marketing or data mining. We do not
train or fine-tune any AI model with it. Automated decisions are limited to matching an
event time to an order window; when rules cannot decide, a model on Amazon Bedrock sees
timing and event metadata only and can never mark an order delivered without an event.

## Who receives it

- The store you authorized, per store or per order: the attestation only (order identifier,
  outcome, time, hash of the event, signature). Never your Ring identifiers or device list.
- Amazon Web Services, which hosts the service and the models, in the United States.

No other third parties. No sale of data.

## Consent and revocation

Linking Ring and authorizing a store are explicit actions in Doorstep. You can revoke a
store, an order or the Ring link at any time from the household panel or by removing the
app in the Ring Appstore. Revocation is immediate: no further matching happens for the
revoked scope.

## Retention and deletion

Event metadata and attestations are kept for 180 days after the order's window closes, or
until you delete them. Ring tokens are wiped on revocation. You can delete everything we
hold about your household at any time ("Delete my data" in the panel or
`DELETE /households/{id}`); deletion covers all copies, backups within 7 days, and any
downstream copy at a store within the same timeframe. We confirm deletion and keep an audit
log of the request that contains no personal data. Stores keep the attestations they
already received as part of their own records.

## Security

HTTPS only. Webhooks are verified with HMAC before parsing. OAuth tokens are stored per
household and encrypted at rest in the hosted tier. Attestations are signed with an Ed25519
key that holds no funds; anyone can verify them offline with the published public key.

## Where data lives

United States (AWS us-east-1), where Ring devices are supported.

## Ring Appstore content policy

Doorstep does not monitor, track or identify individuals, does not perform facial or any
other recognition, does not combine data across households, and does not share data with
law enforcement.

## Children

Doorstep is not directed at children under 13 and does not knowingly collect their data.

## Changes

We will post changes here with a new effective date and notify linked households in the
panel before material changes take effect.
