/**
 * Knowledge Base Ingestion Script
 *
 * Run: npx tsx src/scripts/ingest.ts
 *
 * Seeds the LibSQL vector store with embedded chunks from the knowledge base documents.
 * Requires OPENAI_API_KEY in .env for generating embeddings.
 */

import 'dotenv/config';
import { libsqlVector } from '../mastra/index';
import { ingestKnowledgeBase } from '../mastra/tools/ingest-knowledge';

async function main() {
  console.log('Starting knowledge base ingestion...\n');

  try {
    await ingestKnowledgeBase(libsqlVector);
    console.log('\nDone! Knowledge base is ready.');
  } catch (error) {
    console.error('Ingestion failed:', error);
    process.exit(1);
  }
}

main();
