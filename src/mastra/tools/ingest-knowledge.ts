import { embed } from 'ai';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MDocument } from '@mastra/rag';
import { fastembed } from '@mastra/fastembed';
import type { LibSQLVector } from '@mastra/libsql';

const KNOWLEDGE_DIR = join(import.meta.dirname, '../knowledge');
const INDEX_NAME = 'support_kb';
// fastembed BGE-small outputs 384 dimensions
const EMBEDDING_DIMENSION = 384;

export async function ingestKnowledgeBase(vectorStore: LibSQLVector) {
  const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));

  // Create index (idempotent — will skip if exists)
  const existingIndexes = await vectorStore.listIndexes();
  if (!existingIndexes.includes(INDEX_NAME)) {
    await vectorStore.createIndex({
      indexName: INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }

  for (const file of files) {
    const filePath = join(KNOWLEDGE_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const source = file.replace('.md', '');

    console.log(`Ingesting: ${file}`);

    // Create a document and chunk it
    const doc = MDocument.fromMarkdown(content, { source, file });
    await doc.chunk({
      strategy: 'recursive',
      maxSize: 512,
      overlap: 50,
    });

    const chunks = doc.getDocs();
    const chunkTexts = chunks.map(c => c.text);

    // Embed all chunks using local fastembed (no API key needed)
    const embeddings: number[][] = [];
    for (const text of chunkTexts) {
      const { embedding } = await embed({
        value: text,
        model: fastembed,
      });
      embeddings.push(embedding);
    }

    // Store in vector DB
    await vectorStore.upsert({
      indexName: INDEX_NAME,
      vectors: embeddings,
      metadata: chunks.map((chunk, i) => ({
        text: chunkTexts[i],
        source,
        file,
        chunkIndex: i,
      })),
    });

    console.log(`  → ${chunks.length} chunks embedded and stored`);
  }

  console.log('Knowledge base ingestion complete.');
}
