# Phase 2 — Full Agent Network

## What It Does

Expands the single-agent prototype into a complete multi-agent network: six specialized agents covering every support category, intelligent routing via the Triage Agent, customer context enrichment, model-cost optimization, and per-thread memory. Any support email — simple FAQ, billing dispute, technical bug, or escalation — now routes to the correct specialist and receives a polished, context-aware response.

## How It Works

1. **Specialist agents created** — Billing Agent, Technical Support Agent, Escalation Agent, and Response Composer join the existing FAQ Agent.
2. **Routing workflow extended** — After Triage classifies the email, a `.branch()` step fans out to the matching specialist. Each branch is a Mastra workflow step with its own schema.
3. **Customer context enrichment** — `simulateCustomerTier()` and `simulatePreviousTickets()` inject customer profile data (tier, ticket history) into every agent prompt. In production, this would query a CRM via API.
4. **Model routing** — FAQ Agent and Escalation Agent use **Claude Haiku** (fast, cheap). Billing Agent, Technical Agent, and Response Composer use **Claude Sonnet** (more capable for policy reasoning and tone).
5. **Response Composer** — Takes the specialist's draft and rewrites it into a polished customer-facing email. Adjusts tone based on sentiment (frustrated vs neutral customers get different openers).
6. **Agent memory** — All agents share a `@mastra/memory` instance backed by LibSQL, enabling context to persist across an email thread.
7. **Billing guardrails** — The Billing Agent's system prompt explicitly forbids approving refunds over $500 and promises outside the 14/30-day windows. Tested against known edge cases.

## Screenshots

### Agent Network — Routing Branches
![Workflow routing diagram](./screenshots/phase-2-routing-branches.png)
> Mastra Studio showing the `.branch()` step routing a billing email to the Billing Agent (Sonnet). The FAQ and Technical branches show as skipped.

### Billing Agent — Policy Guardrail
![Billing guardrail in action](./screenshots/phase-2-billing-guardrail.png)
> $750 refund request routed to Billing Agent. Agent correctly declines to approve (exceeds $500 limit) and explains the manager review process. Confidence: 82 → queued for human review.

### Escalation — Handoff Document
![Escalation handoff document](./screenshots/phase-2-escalation-handoff.png)
> Escalation Agent output for an angry enterprise customer. Structured handoff includes: customer tier, issue summary, urgency, what was attempted, and recommended next steps for the human agent.

### Model Routing — Cost Comparison
![Model routing](./screenshots/phase-2-model-routing.png)
> Side-by-side: FAQ email routed to Haiku (~$0.01 in tokens), billing email routed to Sonnet (~$0.08 in tokens). Same quality output, 8x cost difference.

## Key Design Decisions

- **Catch-all escalation branch** — The last branch condition is `async () => true`, so any unclassified email falls through to the Escalation Agent rather than crashing the pipeline. Fail safe, not fail open.
- **Response Composer as a separate step** — Specialist agents focus on *correctness* (getting the policy right); the Composer focuses on *tone* (making it sound human). Separating these concerns produces better output than asking one agent to do both.
- **Simulated customer context** — Real customer lookup would require a CRM integration and latency. The simulation (deterministic hash of email address → tier/ticket count) lets us demonstrate context-aware routing without external dependencies.
- **Memory scoped to thread ID** — Using sender email as thread ID means a customer's second email in the same conversation has full context from the first exchange.

## Test Coverage

- Unit: 6 tests passing (all-agents.test.ts — verifies all 6 agents have correct IDs, names, and model assignments)
- Integration: confidence-gate.test.ts validates the full routing → compose → gate path
- Eval: 20 triage classification tests in `tests/eval/triage-eval.test.ts`

## PM Takeaway

Model routing is a cost decision disguised as a technical one: 70% of support tickets are FAQs that don't need Sonnet's reasoning. Routing those to Haiku reduces per-ticket cost by ~80% without measurable quality loss — the kind of tradeoff that determines whether an AI product is economically viable.
