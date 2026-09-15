# Friction log

Written while building, one entry per obstacle with Ring, AgentCore, Strands, Bedrock or any
Amazon or AWS document, SDK, simulator or console. Severity: Blocking, High, Medium, Low.

Each entry: date, tool, what we tried, what happened (exact error, observed behavior, doc
link), severity, time lost, workaround, concrete suggestion for the Amazon team, link to the
commit or file.

---

## FL-001

- Date: 2026-09-14
- Tool: Ring Developer Portal (getting started)
- What we tried: understand what a company outside the US needs to build against the sandbox.
- What happened: the docs require identity verification with a government ID and a matching
  company profile, recommend "at least one Ring device for testing", and state "Currently we
  only support devices located in the US". The sandbox with synthetic devices is mentioned but
  the list of simulatable event types is not enumerated.
- Severity: Medium
- Time lost: 1 hour
- Workaround: apply with NovaCorpAI SpA's profile; rely on the sandbox and Playground for
  synthetic package and doorbell events; keep the pilot households in the US.
- Suggestion: publish the exact list of synthetic event types and payload versions the
  sandbox can emit, and state eligibility for non-US developer accounts up front.
- Link: 02f0026

## FL-002

- Date: 2026-09-15
- Tool: Ring Developer docs (developer.ring.com and developer.amazon.com/docs/ring)
- What we tried: read the webhook, account linking, event history and certification pages
  to implement step 1 without guessing.
- What happened: every deep link under `developer.ring.com/docs/ring/*` returns 404, and
  on `developer.amazon.com/docs/ring/` the pages `webhooks.html`, `authentication.html`,
  `notifications.html`, `app-registration.html` and `event-history.html` (linked from the
  official hello-world sample and from the docs' own navigation) also 404. Only
  `get-started`, `configure`, `develop`, `certify`, `publish`, `developer-faq`,
  `content-policy`, `release-notes` and `api-documentation` resolve. The webhook event type
  table in the reference lists `motion_detected`, `button_press` and lifecycle events; the
  package classification only appears as `attributes.sub_type` in the motion payload
  example, and the sandbox with "synthetic Ring devices" is announced in get-started but
  its access is documented nowhere. The official sample (`ring-api-helloworld`) verifies
  webhooks with a static bearer token, not with the HMAC the reference specifies.
- Severity: High
- Time lost: 2 hours
- Workaround: took header, encoding, payload shape and OAuth parameters from
  `api-documentation.html` and the sample's zod schema; wrote the parser to accept
  `attributes.source` or `relationships.devices` for the device id; will confirm the
  `sub_type` value for packages in the Playground on the first real event.
- Suggestion: fix the broken links in the docs navigation and the sample README; publish
  the full `sub_type` enum and one full JSON example per webhook type; document how to
  enable the sandbox and what the Playground can emit; make the sample verify `X-Signature`.
- Link: `src/ring/events.ts`, `src/ring/webhook-signature.ts`

## FL-003

- Date: 2026-09-15
- Tool: Node.js `node:sqlite`
- What we tried: run the storage adapter on Node 22.5 as the README promised.
- What happened: `node:sqlite` needs `--experimental-sqlite` below Node 22.13 and still prints
  an ExperimentalWarning on 24.x.
- Severity: Low
- Time lost: 10 minutes
- Workaround: engine raised to `>=22.13`; the warning is cosmetic.
- Suggestion: none for Amazon; noted so nobody lowers the engine again.
- Link: `package.json`, `src/storage/sqlite.ts`
