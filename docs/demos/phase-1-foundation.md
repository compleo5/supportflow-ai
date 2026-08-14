# Phase 1 — Foundation

## What It Does

Establishes the core of SupportFlow AI: a knowledge base seeded with real support content, a RAG pipeline for retrieval, a Triage Agent that classifies incoming emails, and a FAQ Agent that answers product questions using those retrieved documents. The result is an end-to-end path from raw email text to a classified, KB-sourced response — the backbone every other phase builds on.

## How It Works

1. **Knowledge base seeding** — Four markdown documents are chunked and embedded into a LibSQL vector store using the `fastembed` model (local, no API key required for embeddings). Documents: `faq.md`, `product-guide.md`, `billing-policy.md`, `troubleshooting.md`.
2. **RAG tool** — `vector-query.ts` exposes a `search-knowledge-base` tool that takes a query string and returns the top-K most relevant chunks via cosine similarity.
3. **FAQ Agent** — Wraps the RAG tool. Receives an email body, searches the KB, and returns a grounded answer plus a `CONFIDENCE: N` score.
4. **Triage Agent** — Reads the email and returns a structured JSON classification: `{ classification, urgency, sentiment, summary, intents }`.
5. **Routing workflow** — `support-pipeline.ts` chains Triage → branch (FAQ is the only active branch in Phase 1) → response output.
6. **Mastra Studio** — The full flow is testable via the Mastra dev UI at `localhost:4111`.

## Screenshots

### Mastra Studio — Workflow Run
![Workflow run in Mastra Studio](./screenshots/phase-1-studio-workflow.png)
> Mastra Studio showing a completed `support-pipeline` run. Left panel shows inputs; right panel shows the step-by-step trace with the FAQ agent's KB retrieval and confidence score.

### Triage Output — JSON Classification
![Triage classification output](./screenshots/phase-1-triage-output.png)
> Triage Agent output for "How do I reset my password?" classified as `faq`, urgency `low`, sentiment `neutral`.

## Key Design Decisions

- **fastembed over OpenAI embeddings** — Local embedding model means zero embedding API cost and no API key required to run the ingest script. Trade-off: slightly lower retrieval quality than `text-embedding-3-small`, acceptable for a portfolio project.
- **LibSQL as vector store** — Zero infrastructure setup. One file (`mastra.db`) holds both relational data and vector embeddings. In production, pgvector or Pinecone would replace this.
- **Triage returns structured JSON** — Forces the LLM to produce a machine-readable output rather than prose. This makes downstream routing deterministic.
- **Confidence score as a first-class output** — Every agent response includes `CONFIDENCE: N`. This is designed in from day one so Phase 3's confidence gate has consistent data to act on.

## Test Coverage

- Unit: 3 tests passing (triage-agent.test.ts — agent ID, name, description)
- Unit: 3 tests passing (faq-agent.test.ts — agent ID, name, KB tool presence)
- Unit: 2 tests passing (support-pipeline.test.ts — workflow ID, description)
- Integration: covered in `review-lifecycle.test.ts` (store/retrieve cycle)

## PM Takeaway

Starting with a working retrieval pipeline before building agents forces you to validate that the knowledge base is actually useful — a RAG system with bad documents produces confidently wrong answers, so getting the KB right is the real Phase 1 work.
