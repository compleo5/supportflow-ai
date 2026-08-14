# Phase 3a — Confidence Scoring & Gate

## What It Does

Adds a confidence gate to the response pipeline: every agent rates its own answer on a 0–100 scale, and the workflow automatically routes high-confidence responses to send while queuing low-confidence ones for human review. No response goes to a customer without passing this check. Also adds a pre-filter step that catches spam, sales emails, and recruiting outreach before they consume any LLM tokens.

## How It Works

1. **Confidence scoring** — Each specialist agent ends its response with `CONFIDENCE: N`. The workflow step parses this value out of the response text via regex. If parsing fails, the step defaults to 50 (conservative — routes to review).
2. **Confidence gate threshold** — `CONFIDENCE_THRESHOLD = 85` in `support-pipeline.ts`. At or above 85: `autoSent: true`, `status: 'auto-sent'`. Below 85: `autoSent: false`, `status: 'pending'`.
3. **Pre-filter step** — `preFilterStep` runs before triage. It checks subject + body against keyword lists for spam signals, sales language, and recruiting language. Matches throw an error immediately, stored as `status: 'rejected'` with zero LLM calls.
4. **Prompt versioning** — Every stored response includes a `promptVersion` field: an 8-character SHA-256 hash of `agentId:firstChunkOfReply`. This makes it possible to trace which prompt version produced a given response and detect regressions after prompt changes.
5. **Rate limiting** — `checkRateLimit()` runs at the start of the pre-filter step. Customers exceeding 10 requests/hour receive an error with a `resetInSeconds` value.

## Screenshots

### Confidence Gate — High Confidence (Auto-Send)
![Auto-send path](./screenshots/phase-3-gate-auto-send.png)
> FAQ response with `CONFIDENCE: 92`. Workflow marks `autoSent: true`, status `auto-sent`. No human action required.

### Confidence Gate — Low Confidence (Review Queue)
![Review queue path](./screenshots/phase-3-gate-review.png)
> Billing response with `CONFIDENCE: 72`. Workflow marks `status: pending`. Response stored and visible in the Review UI.

### Pre-Filter — Sales Email Rejected
![Pre-filter rejection](./screenshots/phase-3-prefilter.png)
> Email with "partnership opportunity" in subject. Pre-filter catches it at step 0, throws error, zero LLM tokens consumed. Stored as `classification: 'sales'`, `status: 'rejected'`.

### Prompt Version Tracing
![Prompt version in response detail](./screenshots/phase-3-prompt-version.png)
> Response detail showing `promptVersion: a3f72c91`. After updating the FAQ agent's system prompt, new responses get a different hash — easy to spot which KB update caused a quality change.

## Key Design Decisions

- **85% threshold is a tunable constant** — Not hardcoded in a config file, but declared as a named constant at the top of `support-pipeline.ts`. Changing it is a one-line edit. In production, this would be an A/B-tested parameter.
- **Agents self-report confidence** — Having the agent rate its own answer is cheaper than a separate evaluator call, but less reliable. A production system would use a secondary LLM-as-judge pass for high-stakes categories (billing, escalation). The self-report approach is a deliberate Phase 3 simplification.
- **Pre-filter uses keyword matching, not LLM** — LLM classification for spam would be more accurate but wastes tokens on emails that should never enter the pipeline. Keywords handle 95% of the obvious cases for free.
- **Rate limiter as first guard** — Rate limiting runs before even the pre-filter, ensuring a customer can't abuse the system even with legitimate-looking emails.

## Test Coverage

- Unit: confidence gate threshold logic (CONFIDENCE_THRESHOLD = 85)
- Integration: 14 tests in `confidence-gate.test.ts` — boundary conditions (84/85/86), high/low confidence routing, auto-sent vs pending filter separation, escalation classification pass-through
- Integration: 11 tests in `rate-limiter.test.ts` — sequential requests, limit exhaustion, customer isolation, case-insensitivity, boundary at 10th/11th request

## PM Takeaway

The confidence threshold is the most important product decision in the system: set it too high and the AI never sends anything autonomously (no value); set it too low and bad responses reach customers (loss of trust). Starting at 85% and tuning based on eval data is the right strategy — you can't pick the right number without measuring first.
