# AWS integration

Services used, why each, and where in the code. Updated as modules land.

| Service | Why | Where |
| --- | --- | --- |
| Amazon Bedrock (Nova 2 Lite) | simple ambiguous cases, cheap and fast | `src/matching/agent.ts` (planned) |
| Amazon Bedrock (Claude Sonnet) | genuinely ambiguous cases with several candidates | `src/matching/agent.ts` (planned) |
| Bedrock AgentCore Runtime | hosts the matching agent with traces | `deploy/agentcore/*` (planned) |
| Strands Agents SDK | agent orchestration | `src/matching/agent.ts` (planned) |
| AWS Lambda + API Gateway (or App Runner) | webhook ingest with HMAC verification | `src/web/app.ts` (Hono, runtime-agnostic), `src/ring/webhook-signature.ts`; `deploy/*` (planned) |
| Amazon EventBridge Scheduler | closes expired delivery windows | `src/matching/expiry.ts` (planned) |

Target: most cases resolved by rules with no model call; measured share and cost per
confirmation in `docs/COSTS.md`. Region: us-east-1.
