# Phase 3c — Learning Loop

## What It Does

Closes the feedback flywheel: every human review action (approve, edit, reject) feeds back into the knowledge base. Approved responses are embedded as verified Q&A pairs. Edited responses are embedded with the reviewer's correction instead of the original draft. Rejected responses are logged for pattern analysis. Over time, the KB grows with high-quality, human-validated answers — and the auto-send rate should increase as retrieval improves.

## How It Works

1. **`processReviewedResponse(record, vectorStore)`** — The core learning loop function in `learning-loop.ts`. Called by the Review UI action handlers after a review action completes.
2. **Approved path** — Builds a Q&A document combining the original email, the approved reply, and any reviewer feedback. Embeds the document using `fastembed` and upserts it into the `support_kb` vector index.
3. **Edited path** — Same as approved, but uses `record.editedReply` instead of `record.emailReply`. The correction replaces the original draft in the KB entry. The reviewer's feedback (e.g., "should mention 30-day grace period") is included as metadata.
4. **Rejected path** — No embedding. Logs the rejection for pattern analysis. In production, repeated rejections on the same classification would trigger an alert to review the agent's prompt or KB coverage.
5. **Skipped statuses** — `pending` and `auto-sent` responses return `{ action: 'skipped', chunksAdded: 0 }`. Auto-sent responses are presumed correct but not yet human-validated; they bypass the loop to avoid polluting the KB with unreviewed content.
6. **Prompt versioning in metadata** — Each KB chunk stores the `originalConfidence` and `reviewStatus` so future eval runs can distinguish human-validated entries from seed documents.

## Screenshots

### Learning Loop — KB Growth Over Time
![KB growth chart](./screenshots/phase-3-learning-kb-growth.png)
> Dashboard chart showing knowledge base chunk count growing from 43 (seed) to 67 (after 2 weeks of reviews). Each approved/edited response added 1 chunk.

### Approved Response — Embedded to KB
![Learning loop approval flow](./screenshots/phase-3-learning-approval.png)
> Mastra Studio trace: Review UI calls `submit-review` tool with `action: approve`. Learning loop fires, embedding is computed, `vectorStore.upsert()` completes. Log line: `[Learning Loop] added_verified — response abc-123 added to KB`.

### Edited Response — Correction Captured
![Learning loop correction](./screenshots/phase-3-learning-correction.png)
> Edited response embedded to KB. The chunk text shows the reviewer's corrected reply (not the original draft) alongside the customer's question. Source metadata: `source: learning-loop`, `reviewStatus: edited`.

### Correction Rate Trend
![Correction rate trend](./screenshots/phase-3-learning-trend.png)
> Week-over-week chart: correction rate (edits / total reviews) declining from 35% to 18% over 4 weeks. Demonstrates the flywheel is working.

## Key Design Decisions

- **RAG updates over fine-tuning** — Adding human-validated Q&A pairs to the knowledge base is cheaper ($0 vs significant fine-tuning costs), faster (immediate, no training job), and more auditable (you can inspect every KB chunk). Fine-tuning is the right choice when you have thousands of examples and need to change the model's reasoning patterns — not for evolving support content.
- **Edited reply, not original** — When a reviewer corrects a draft, the KB should learn the *right* answer, not the wrong one. Using `editedReply` for the embedding is a deliberate choice to prevent bad answers from accumulating in the KB even indirectly.
- **No auto-sent responses in the loop** — Auto-sent responses are presumed correct by the confidence gate but haven't been validated by a human. Including them would gradually lower the KB's quality bar. Human review is the quality gate for KB ingestion.
- **Chunk index 0** — Current implementation stores each Q&A as a single chunk (no splitting). For very long email threads, a production system would chunk by section and store multiple vectors per response.

## Test Coverage

- Integration: 12 tests in `learning-loop.test.ts`
  - Approved: embeds with correct index name, metadata, and Q&A text content
  - Approved: reviewer feedback included in embedded text
  - Edited: uses `editedReply` not `emailReply` in KB chunk
  - Edited: falls back to `emailReply` if `editedReply` is undefined
  - Rejected: no embedding, returns `{ action: 'logged_rejection', chunksAdded: 0 }`
  - Pending: skipped, no embedding
  - Auto-sent: skipped, no embedding

## PM Takeaway

A learning loop is only valuable if the data going in is high quality. The most important design decision here is *what earns a place in the KB* — only human-reviewed responses qualify. This is a deliberate product constraint that trades KB growth speed for KB quality.
