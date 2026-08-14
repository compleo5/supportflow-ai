# Phase 3b — Review UI

## What It Does

A browser-based interface for the human support team to review, approve, edit, or reject AI-drafted responses that fell below the confidence threshold. Displays the full context for each pending response — original email, agent draft, confidence score, classification metadata — so reviewers have everything they need without switching tools. Actions feed directly into the learning loop.

## How It Works

1. **Data layer** — `response-store.ts` maintains an in-memory store (production: LibSQL table) of all pipeline outputs. The Review UI reads from this via `review-api.ts` tools exposed through Mastra.
2. **Static HTML frontend** — `src/review-ui/index.html` is a self-contained single-file app served via `npm run review-ui` (port 3456). Calls the Mastra API at `localhost:4111` to fetch and update responses.
3. **Stats bar** — Shows live aggregate metrics: total responses, pending count, auto-send rate %, average confidence score.
4. **Inbox tabs** — "Pending Review" and "All Responses" tabs. Pending shows only `status: 'pending'` records. All shows the full history with status badges.
5. **Detail view** — Clicking a response opens a panel showing:
   - Original customer email
   - Agent's raw draft (`reply`)
   - Composed email reply (`emailReply`)
   - Classification, urgency, sentiment, confidence score
   - Customer tier, handler agent ID, prompt version hash
6. **Action buttons**:
   - **Approve** — Updates status to `'approved'`, triggers learning loop to embed the Q&A pair into the KB.
   - **Edit & Send** — Opens an editable textarea. The reviewer's correction is stored as `editedReply`. Status becomes `'edited'`. Learning loop embeds the *corrected* answer.
   - **Reject** — Status becomes `'rejected'`. Learning loop logs the pattern without embedding.
7. **Feedback field** — Free-text input on every response. Stored in `feedback` field. Embedded into the KB document as reviewer context (e.g., "Should mention the 30-day grace period").

## Screenshots

### Review Inbox — Pending Queue
![Review inbox](./screenshots/phase-3-review-inbox.png)
> The pending review queue showing 3 responses below 85% confidence. Stats bar at top: 12 total, 3 pending, 75% auto-send rate, avg confidence 87.

### Response Detail View
![Response detail](./screenshots/phase-3-review-detail.png)
> Full detail view for a billing response (confidence 72). Left: original customer email. Center: agent draft. Right: metadata panel with classification, urgency, sentiment, customer tier, and action buttons.

### Edit & Send Flow
![Edit response](./screenshots/phase-3-review-edit.png)
> Reviewer editing an FAQ response draft — textarea open, reviewer has added a note about the 30-day grace period. Feedback field filled. "Edit & Send" button active.

### Response History
![Response history](./screenshots/phase-3-review-history.png)
> "All Responses" tab showing mix of statuses: auto-sent (green), approved (blue), edited (yellow), rejected (red). Filter controls visible at top.

## Key Design Decisions

- **Static HTML, not Next.js** — The project plan specified Next.js 15, but a self-contained HTML file served by a static server is faster to iterate on and removes a build step from the demo setup. For production, the review UI would be a proper Next.js app with server-side rendering and auth.
- **Mastra Studio vs custom UI** — Mastra Studio (port 4111) is used for workflow inspection and development. The Review UI is the customer-facing operations tool. They serve different audiences: Studio for engineers, Review UI for support team leads.
- **Optimistic UI updates** — Actions update the local state immediately before the API call resolves. Keeps the UI snappy during demos even when Mastra API has latency.
- **Confidence score prominently displayed** — Every response card shows the confidence score in large text with a color band (red < 70, yellow 70–84, green ≥85). Reviewers develop intuition for which scores need careful scrutiny.

## Test Coverage

- Unit: response-store CRUD functions (getResponseById, updateResponse, getStats)
- Integration: 19 tests in `review-lifecycle.test.ts` — full approve/edit/reject lifecycle, status filtering, stats accuracy, prompt version determinism

## PM Takeaway

The Review UI is where human-AI collaboration becomes concrete. Designing it well — showing the right context, making actions frictionless — determines whether support agents trust the system. A clunky review interface causes reviewers to rubber-stamp everything, which defeats the purpose of human-in-the-loop.
