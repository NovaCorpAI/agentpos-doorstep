# Unit costs

Filled from `usage_events`. Unit: one **delivery confirmation** (an order closed as
`delivered`, `missing` or `uncertain`). Second unit: store per month (what the add-on charges).

| Step | Model | Share of cases | Tokens in | Tokens out | Cost |
| --- | --- | --- | --- | --- | --- |
| Rule-resolved (no model) | none | | 0 | 0 | ~0 |
| Agent, simple ambiguity | Nova 2 Lite | | | | |
| Agent, hard ambiguity | Claude Sonnet via Bedrock | | | | |
| Total per confirmation | | | | | |

Target: rules resolve at least 80% of cases; cost per confirmation under US$0.03; hosted
fixed cost under US$1 per store per month. If the agent runs on more than 20% of cases, fix
the rules before touching the model.
