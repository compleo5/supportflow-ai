# SupportFlow AI — Demo Walkthrough

## Setup (one time)

```bash
cp .env.example .env
# Add ANTHROPIC_API_KEY to .env

npm install
npm run ingest    # Seeds 43 KB chunks (runs locally, ~30 seconds)
npm run dev       # Starts Mastra Studio at localhost:4111
npm run review-ui # Starts Review UI at localhost:3456 (separate terminal)
```

---

## Demo Script

### 1. Simple FAQ (auto-resolved, high confidence)

**In Studio** → Workflows → `support-pipeline` → Run:

```json
{
  "emailBody": "What plans do you offer and what's the pricing?",
  "senderEmail": "prospect@example.com",
  "subject": "Pricing question"
}
```

**What to show:**
- Triage classifies as `faq` / `low` urgency / `neutral` sentiment
- FAQ Agent searches KB, finds pricing info
- Response Composer polishes it into a friendly email
- Confidence likely ≥85% → auto-sent
- Zendesk ticket created (demo mode: logged to console)

**Talking point:** "Simple questions get resolved instantly without human involvement. The model routing sends this to Haiku — fast and cheap."

---

### 2. Billing with Guardrails (policy enforcement)

```json
{
  "emailBody": "I want a full refund of $750 for my annual plan. I signed up 2 months ago and the product doesn't meet our needs.",
  "senderEmail": "sarah@enterprise-corp.com",
  "subject": "Refund request - $750"
}
```

**What to show:**
- Triage classifies as `billing` / `medium-high` urgency
- Routes to Billing Agent (Sonnet — more capable model for policy reasoning)
- Agent finds the $500 guardrail: refunds >$500 require manager approval
- Agent should NOT approve the refund, instead explains the escalation process
- Confidence may be <85% → queued for review

**Talking point:** "The Billing Agent enforces business rules. It knows it can't approve refunds over $500. This is the kind of guardrail that prevents costly AI mistakes."

---

### 3. Technical Troubleshooting (RAG + diagnostics)

```json
{
  "emailBody": "The dashboard is loading extremely slowly. It takes over 30 seconds. I've tried Chrome and Firefox, my internet is fast, and I cleared my cache. Nothing helps.",
  "senderEmail": "dev@startup.io",
  "subject": "Dashboard performance issue"
}
```

**What to show:**
- Triage classifies as `technical` / `medium` urgency
- Routes to Technical Agent (Sonnet)
- Agent searches KB for performance troubleshooting runbook
- Provides structured numbered steps based on KB articles
- Mentions checking status.supportflow.io

**Talking point:** "The Technical Agent follows our runbooks, not hallucinated advice. It retrieves the actual troubleshooting steps we've documented."

---

### 4. Escalation (handoff + Zendesk + Slack)

```json
{
  "emailBody": "This is the THIRD time I'm writing about this billing error. Nobody has fixed it. I want to speak to a manager RIGHT NOW or I'm cancelling my enterprise contract and contacting my lawyer.",
  "senderEmail": "vp@bigcorp.com",
  "subject": "URGENT - Unresolved billing error - NEED MANAGER"
}
```

**What to show:**
- Triage classifies as `escalation` / `critical` urgency / `angry` sentiment
- Escalation Agent generates a structured handoff document with:
  - Customer context
  - What was attempted
  - Recommended next steps for the human agent
- Zendesk ticket created with `urgent` priority + `escalation` tag
- Slack alert sent with the full handoff doc

**Talking point:** "The system knows when to stop trying. It creates a complete handoff so the human agent has full context without asking the customer to repeat themselves."

---

### 5. Spam Filtering (pre-filter)

```json
{
  "emailBody": "Congratulations! You have been selected for an exclusive partnership opportunity. Schedule a demo today!",
  "senderEmail": "sales@spamco.com",
  "subject": "Exclusive offer for your company"
}
```

**What to show:**
- Pre-filter catches this as sales/spam
- Workflow fails immediately — no LLM tokens spent
- No Zendesk ticket created

**Talking point:** "Non-support emails are filtered before they reach the AI. This saves API costs and keeps the support queue clean."

---

### 6. Review UI (human-in-the-loop)

**In Review UI** (localhost:3456):

1. Show the stats bar — total responses, pending count, auto-send rate, avg confidence
2. Click the **Pending Review** tab — show responses below 85% confidence
3. Click into a pending response — show the detail view:
   - Original email, agent draft, composed reply
   - Classification, confidence score, urgency, sentiment
   - Customer tier, handler agent, prompt version
4. **Edit the reply** — make a small improvement
5. Add **feedback**: "Good answer but should mention the 30-day grace period"
6. Click **Edit & Send**
7. Show the toast notification
8. Explain: "That edited response just got embedded into the knowledge base. Next time a similar question comes in, the agent will find this verified answer."

**Talking point:** "This is the feedback flywheel. Every human review makes the system smarter. Over time, the auto-send rate goes up and the correction rate goes down."

---

### 7. Rate Limiting

Run the same email 11 times rapidly with the same `senderEmail`. On the 11th attempt, the workflow will fail with a rate limit error.

**Talking point:** "Per-customer throttling prevents one angry customer from burning through your API budget with 50 rage emails."

---

## Key Metrics to Highlight

| Metric | What It Shows |
|---|---|
| Auto-send rate | % of tickets resolved without human involvement |
| Avg confidence | How certain the AI is about its answers |
| Correction rate over time | Should decrease as KB improves |
| Cost per ticket | Haiku for simple ($0.01-0.05), Sonnet for complex ($0.05-0.20) |
| Escalation rate | Should be <15% — too high = agents aren't useful |

---

## Portfolio Talking Points

1. **"I designed for failure gracefully"** — The confidence gate ensures bad answers never reach customers.
2. **"I built a feedback flywheel"** — Human corrections make the system smarter over time.
3. **"I think about cost"** — Model routing sends 70% of tickets to the cheaper model.
4. **"I know AI limitations"** — Escalation agent knows when to hand off to humans.
5. **"I connected to real tools"** — Zendesk, Slack, email — not just a toy demo.
6. **"I measure outcomes"** — Eval suite, confidence tracking, prompt versioning.
7. **"I think in systems"** — Full architecture from email intake to resolution tracking.
