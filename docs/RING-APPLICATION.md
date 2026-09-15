# Ring Developer Console: application and certification kit

Everything to paste into the Ring Developer Console, in the order the console asks for it.
Source: Ring Developer docs (get-started, configure, certify, publish, API reference) as read
on 2026-09-15. Console: https://developer.amazon.com/ring/console

## 0. Before opening the console

- [ ] Amazon developer account for NovaCorpAI SpA. The **Company Profile** legal name must
      match the government ID exactly (passport or national ID of the person verifying).
- [ ] Identity verification: photos of the front and back of the ID. Minutes to complete,
      three attempts allowed. Do this before creating the app, it blocks submission.
- [ ] Public HTTPS base URL for staging (a tunnel is fine during development). Ring needs it
      for the Token Exchange URL, the Default Redirect URL and the Webhook URL.
- [ ] A US Ring account with at least one camera or doorbell for the Test phase (the sandbox
      with synthetic devices exists but its access is not documented; see FL-002).
- [ ] Privacy policy, terms and support URLs published (`docs/PRIVACY-POLICY.md`,
      `docs/TERMS.md`; GitHub URLs are acceptable until the domain is up).

## 1. Create the app

| Field | Value |
| --- | --- |
| Internal app name | `AgentPOS Doorstep` |
| App type | Public app (Ring Appstore). Do not pick Private: it skips certification, which is the point. |
| API scopes | Cameras and Doorbells (motion events, doorbell presses). Account and Lifecycle is always on. Do **not** request livestream or video download. |

The console shows **Client ID**, **Client Secret** and **HMAC Signature Key** once. Put them
straight into `.env` as `RING_CLIENT_ID`, `RING_CLIENT_SECRET`, `RING_WEBHOOK_HMAC_KEY`.
They cannot be regenerated on an existing app.

## 2. App information (General tab)

**Public name** (50 chars max)

```
Doorstep: proof of delivery
```

**Short description** (125 chars max)

```
Turns your Ring package alert into signed proof of delivery for your online orders. No video, ever. You choose which stores.
```

**Detailed description** (500 chars max)

```
Doorstep links your Ring doorbell to the orders you buy online. When Ring detects a package inside the expected delivery window, Doorstep issues a signed, timestamped attestation you and the store can both verify offline. If nothing arrives, you both know before the window closes. It reads only event metadata (type, device, time), never video or snapshots. You choose which stores may receive confirmations and can revoke at any time. Independent evidence for refunds, chargebacks and porch theft reports.
```

**Category**: Package and delivery (or the closest available).

**Latest release notes** (500 chars max)

```
First release. Link Ring, choose which stores may receive delivery confirmations, and get signed proof of delivery or a missed-delivery notice per order. Metadata only, no video.
```

## 3. Media assets

- Icon 1024x1024 PNG: a doorstep with a package and a check mark, no Ring branding
  (marketing guidelines forbid using the Ring logo as if it were ours).
- Main image and 1 to 5 screenshots: household panel (link Ring, consents), order timeline
  with the attestation, verification page. Capture them from synthetic data only.
- Optional 50 second video: same cut as the hackathon demo, shortened.

## 4. Compatibility tab

- Features: package alerts, doorbell press events.
- Requirements: Ring camera or doorbell with Package Alerts enabled; a Ring plan that
  includes package detection.
- Customer types: households receiving online orders.
- Supported devices: any Ring doorbell or camera that emits `motion_detected` with
  `sub_type` package.

## 5. Additional tab

| Field | Value |
| --- | --- |
| Developer | NovaCorpAI SpA |
| Website | https://github.com/NovaCorpAI/agentpos-doorstep (until the product domain is live) |
| Support URL | https://github.com/NovaCorpAI/agentpos-doorstep/issues |
| Privacy policy URL | https://github.com/NovaCorpAI/agentpos-doorstep/blob/main/docs/PRIVACY-POLICY.md |
| Terms URL | https://github.com/NovaCorpAI/agentpos-doorstep/blob/main/docs/TERMS.md |

## 6. Account linking (Staging and Production tabs)

All HTTPS, all served by `src/web/app.ts`.

| Console field | Value | Code |
| --- | --- | --- |
| Account Link URL | `https://<host>/ring/link/start` | `GET /ring/link/start` |
| Default Redirect URL | `https://<host>/ring/link/callback` | `GET /ring/link/callback` |
| Token Exchange URL | `https://<host>/ring/link/callback` | same handler exchanges the code |
| Webhook URL | `https://<host>/ring/webhook` | `POST /ring/webhook` |
| iOS / Android app links | leave empty (web only) | |

OAuth: partner-initiated, PKCE S256, scope `ava.v1:read`, token endpoint
`https://oauth.ring.com/oauth/token`. Webhooks: `X-Signature: sha256=<hex HMAC-SHA256 of raw body>`,
must answer 200 within 5 seconds, idempotent on `meta.request_id`.

## 7. Test phase

Up to 10 staging users on a public app. Add the two US pilot households here once they have
signed the consent form (see `docs/SECURITY.md`, "Pilot households"). Validate with the
Developers Playground: it simulates Package, Vehicle and Motion events.

## 8. Certification: Privacy and Security Questionnaire

Five tabs. Draft answers, to be adjusted to the exact wording of each question.

### General

- Business: NovaCorpAI SpA, Chile. Software for agentic commerce (AgentPOS). Years in
  operation: fill in.
- Business context: Doorstep is an add-on that gives households and online stores
  independent, verifiable proof of delivery from Ring package events. It is being built for
  the Amazon Build, Ship, Shape hackathon 2026 and will remain open source (Apache-2.0).

### Data processing

- Collected from Ring: account id, device ids, and per event: type, sub type, device, time,
  event id, delivery id. Nothing else. No video, no snapshots, no thumbnails, no bounding
  boxes (dropped at parse time, `src/ring/events.ts`).
- Purpose: match a package or doorbell event to an order's expected delivery window and
  issue a signed attestation. Notify the household and, with consent, the store.
- Video metadata: not processed beyond the classification Ring already provides.
- AI training: none. No Ring data is used to train or fine-tune any model.
- Disclosure: privacy policy and terms linked above.

### AI governance

- Models: Amazon Bedrock, Amazon Nova 2 Lite and Claude Sonnet, only when deterministic
  rules cannot decide (two open orders, event just outside the window). The model receives
  order timing and event metadata, never media, and can only downgrade or explain, never
  mark an order delivered without an event.
- Monitoring: every call logged in `usage_events` with model, tokens, latency, cost. Rule
  share and agent share reported in `docs/COSTS.md`. Drift check: agent share above 20% of
  cases triggers a rules review before any model change.
- Version management: model ids pinned in configuration; changes are commits.

### Data protection

- Architecture: Node.js service, HTTPS only, HMAC-verified webhooks, OAuth tokens stored per
  household and wiped on revocation. SQLite locally, managed Postgres in the hosted tier,
  encrypted at rest, region us-east-1. Data flow diagram: `docs/ARCHITECTURE.md`.
- Backups: hosted tier daily snapshots, 7 day retention, same deletion applies.
- Security program: dependency policy (pnpm minimum release age 24h, no install scripts),
  CI typecheck and tests, `docs/SECURITY.md`. No external attestation yet (SOC 2 not
  applicable at this size); state that plainly.
- Vulnerability management: GitHub security advisories, same-week patching.

### Third parties

- Recipients: the store the household authorized (attestation only: order id, outcome,
  time, event hash, signature). AWS (Bedrock, hosting). No brokers, no advertising.
- Vetting: AWS under its standard terms; stores accept `docs/TERMS.md`.
- User controls: consent per store or per order, revocable in the household panel;
  revocation stops sharing immediately. Full deletion endpoint `DELETE /households/:id`
  removes tokens, consents and events, with an audit log of the request.

## 9. Certification: reviewer instructions

**Account creation**

```
1. Open https://<host>/ (staging). No account is needed to link Ring.
2. Click "Link Ring". You are redirected to Ring, sign in with the staging Ring account
   provided below, approve access. You land back on Doorstep with a household id.
Staging Ring account: <email> / <password> (ask in the review thread)
```

**Account linking**

```
1. GET https://<host>/ring/link/start redirects to
   https://account.ring.com/account/integrations/partner-link/authorize with PKCE (S256),
   scope ava.v1:read and a random state.
2. Ring redirects to https://<host>/ring/link/callback?code=...&state=...
3. Doorstep exchanges the code at https://oauth.ring.com/oauth/token, calls GET /v1/users/me
   and stores the household. Unlinking from the Ring app invalidates the tokens on Ring's
   side and Doorstep stops matching for that household at the next event.
```

**End to end**

```
1. Create a synthetic order in the merchant panel with a delivery window of the next 2 hours.
2. In the Developers Playground, simulate a Package event on the linked device.
3. Within seconds the order shows "delivered", with the signed attestation and a "Verify"
   button that checks the signature offline.
4. Simulate nothing for a second order and let the window expire: the order shows "missing".
5. DELETE /households/<id> (button "Delete my data") removes everything; GET /ring/events
   returns an empty list.
```

## 10. After certification

Publish: distribution United States (Nationwide), gradual rollout. Then move the account
linking URLs from the Staging tab to Production.
