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
- Time lost: [fill]
- Workaround: apply with NovaCorpAI SpA's profile; rely on the sandbox and Playground for
  synthetic package and doorbell events; keep the pilot households in the US.
- Suggestion: publish the exact list of synthetic event types and payload versions the
  sandbox can emit, and state eligibility for non-US developer accounts up front.
- Link: [commit]
