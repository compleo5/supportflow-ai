# Evals & Scorers — Native Mastra Quality Measurement

## What It Does

Replaces ad-hoc Vitest assertions with Mastra's native eval system — typed scorers that run against agent outputs, persist scores to LibSQL, and surface trends in Mastra Studio. Two modes: **live scoring** (every agent call) and **experiment runs** (20 labelled test emails on demand).

## How It Works

### Scorers (`src/mastra/evals/scorers.ts`)

Five scorers, each with a score (0–1) and a human-readable reason:

| Scorer | Type | Used | Measures |
|---|---|---|---|
| `json-format` | Code (rule-based) | Live + Experiment | Triage output is valid JSON with all 3 required fields |
| `classification-accuracy` | Code | Experiment only | Classification label vs ground truth (0 or 1) |
| `urgency-accuracy` | Code, partial credit | Experiment only | Urgency vs ground truth — ordered scale, not binary |
| `sentiment-accuracy` | Code | Experiment only | Sentiment label vs ground truth (0 or 1) |
| `answer-relevancy` | LLM-as-judge (Haiku) | Live (20% sampling) | Does the composed email actually address the customer's issue? |

### Live scoring

Scorers attached to agents fire on every call through the running Mastra server. Results persist to LibSQL automatically and appear in **Studio → Agents → [agent] → Evals**.

```
triage-agent call
      │
      ▼
json-format scorer (100% sampling)   → score + reason stored in LibSQL
```

```
response-composer call
      │
      ▼
answer-relevancy scorer (20% sampling) → LLM-as-judge scores relevance
```

### Experiment runner (`tests/eval/triage-eval.test.ts`)

Uses `runExperiment()` from `@mastra/core/datasets` to batch-test the triage agent against a labelled dataset of 20 emails. Runs up to 3 items concurrently, scores each with all 4 accuracy scorers, persists everything to LibSQL.

```bash
npm run test:eval
```

Output:
```
─── Triage Agent Eval Results ───────────────────────────────
Items: 20/20 succeeded

  json-format                  avg: 100.0%
  classification-accuracy      avg: 100.0%
  urgency-accuracy             avg: 91.8%
  sentiment-accuracy           avg: 85.0%
─────────────────────────────────────────────────────────────
```

### Dataset (`tests/eval/test-emails.ts`)

20 labelled `DataItem<string, TriageGroundTruth>` objects — 5 per category (faq, billing, technical, escalation). Each has:
- `input` — prompt string sent to the triage agent
- `groundTruth` — expected `{ classification, urgency, sentiment }`

Ground truth flows into scorers via `run.groundTruth` — no manual wiring required.

### Urgency partial credit

Urgency is an ordered scale (`low < medium < high < critical`), so being one level off is less wrong than being fully wrong. The scorer penalises proportionally:

| Distance | Score |
|---|---|
| 0 (correct) | 1.0 |
| 1 level off | 0.67 |
| 2 levels off | 0.33 |
| 3 levels off | 0.0 |

This makes the Studio trend chart meaningful — a drop from 1.0 to 0.67 signals a near-miss, not a hard failure.

## Key Design Decisions

- **Live scorers ≠ experiment scorers** — `json-format` and `answer-relevancy` work live because they need no ground truth. `classification-accuracy`, `urgency-accuracy`, and `sentiment-accuracy` are experiment-only — they always return 0 live because no ground truth is provided. Attaching them to live agents would pollute the Studio charts with meaningless zeros.

- **`runExperiment` over raw Vitest loops** — The old approach called `triageAgent.generate()` in a loop and did string comparisons. Nothing persisted. `runExperiment` writes every score to LibSQL, which means you can see accuracy trends in Studio as the knowledge base grows — the core "learning loop is working" story.

- **20% sampling on `answer-relevancy`** — The LLM-as-judge scorer uses Haiku but still costs tokens on every scored call. 20% sampling gives enough signal to detect quality regressions without scoring every single response composer call.

- **Separate `generateReason()` on every scorer** — Without reasons, Studio shows "N/A — code-based scorer does not generate a reason". With them, each score shows exactly why: `"Off by 1 level — expected 'high', got 'medium'"`. This is what makes the eval results useful for debugging rather than just pass/fail.

- **Thresholds set below current performance** — Classification ≥ 80% (currently 100%), urgency ≥ 70% (currently 92%), sentiment ≥ 70% (currently 85%). This gives headroom for natural variation across runs while still catching regressions. Thresholds should be raised as the KB matures.

## Test Results

```
✓ all items executed without error
✓ json-format score = 100%
✓ classification-accuracy ≥ 80%   (actual: 100%)
✓ urgency-accuracy ≥ 70%          (actual: 92%)
✓ sentiment-accuracy ≥ 70%        (actual: 85%)

Test Files  1 passed | Tests  5 passed | Duration  10.4s
```

## PM Takeaway

Scorers are the difference between "the agent seems to work" and "the agent works at 100% classification accuracy and 92% urgency accuracy, and we'll know immediately if either drops." The experiment-vs-live split reflects a real product decision: some metrics only make sense at evaluation time (accuracy against ground truth), while others are worth tracking continuously in production (output format validity, response relevance). Designing that distinction upfront prevents the common mistake of either measuring nothing or measuring everything and drowning in noise.
