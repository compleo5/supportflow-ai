# Agent Processors — Security, PII & Safety Guardrails

## What It Does

Adds a middleware layer to every agent in the pipeline that intercepts messages before they reach the LLM and after the LLM responds. This prevents prompt injection attacks, blocks abusive content, redacts customer PII from outgoing replies, strips leaked secrets, and caps email length — without any changes to agent logic or workflow code.

## How It Works

Mastra processors are classes that implement `processInput()` and/or `processOutputStream()` / `processOutputResult()`. They run in declaration order and can abort, rewrite, or pass through content at each stage.

All processors are defined once in `src/mastra/processors.ts` and imported into agent definitions.

### Input pipeline (before the LLM sees the message)

```
Customer email
      │
      ▼
ModerationProcessor       ← triage agent only
(blocks harassment/abuse/hate, threshold 0.7)
      │
      ▼
PromptInjectionDetector   ← all agents
(blocks jailbreaks and instruction overrides, threshold 0.7, strategy: block)
      │
      ▼
   LLM call
```

### Output pipeline (after the LLM responds)

```
   LLM response
        │
        ▼
PIIDetector               ← response-composer only
(redacts emails, phones, credit cards, SSNs, IPs, API keys)
        │
        ▼
RegexFilterProcessor      ← all agents
(zero-cost regex pass: catches secrets/tokens not caught by PII detector)
        │
        ▼
TokenLimiterProcessor     ← response-composer only
(truncates at 800 tokens — keeps customer emails concise)
        │
        ▼
  Returned response
```

### Processor assignment per agent

| Agent | Input | Output |
|---|---|---|
| **triage** | Moderation + Injection detector | Secrets filter |
| **billing** | Injection detector | Secrets filter |
| **technical** | Injection detector | Secrets filter |
| **faq** | Injection detector | Secrets filter |
| **escalation** | Injection detector | Secrets filter |
| **response-composer** | Injection detector | PII redactor + Secrets filter + Token limiter |

## Key Design Decisions

- **Moderation only on triage, not all agents** — Triage is the first touch on every inbound email, so it's the right place to filter abusive content before it fans out to specialist agents. Running moderation on all agents would double the LLM cost with no added benefit.

- **PIIDetector only on response-composer** — PII redaction matters on the *output* that reaches the customer. Running it on internal specialist agents (billing, technical) would redact content the agents legitimately need to reason about (e.g. a customer's email address in their refund request).

- **RegexFilterProcessor as a cheap safety net on all agents** — The PII detector is LLM-based and catches nuanced patterns but costs tokens. The regex filter is zero-cost and catches unambiguous patterns (API keys, tokens, bearer strings) that should never appear in any output regardless of context. Running both in sequence gives depth of defence.

- **Token limiter at 800, not lower** — 800 tokens is roughly 600 words — enough for a thorough 4-paragraph support reply. Shorter limits risk truncating mid-sentence. The response composer's instructions already ask for 2-4 paragraphs; the limiter is a hard backstop, not a primary constraint.

- **Strategy: block for injection/moderation, redact for PII** — Injection attacks and abuse should hard-fail — the customer sees an error, which is the correct response to bad-faith input. PII in output should be silently redacted rather than erroring — from the customer's perspective the reply should just arrive correctly.

- **Haiku for all processor LLM calls** — Moderation, PII detection, and injection detection all use `claude-haiku-4-5`. These are classification tasks with short inputs and structured outputs — they don't need Sonnet's reasoning capability, and using Haiku keeps the per-email processor overhead under $0.001.

- **Shared module pattern** — All processors are instantiated once in `processors.ts` and imported by agents. This avoids creating separate detector instances per agent (each of which would hold its own internal agent state) and makes it easy to tune thresholds in one place.

## Test Coverage

- Typecheck: passing (all processor types verified by TypeScript)
- Integration: existing pipeline tests continue to pass — processors are transparent to the workflow layer
- Manual: tested via Mastra Studio chat on triage-agent and response-composer

## PM Takeaway

Processors make safety a first-class architectural concern rather than an afterthought bolted onto prompts. The layered approach — cheap regex first, LLM-based detection second, hard block vs. silent redact depending on context — is the same pattern used in production AI systems at scale. It also demonstrates that guardrails don't have to be monolithic: each processor has a single responsibility and can be tuned, swapped, or disabled independently.
