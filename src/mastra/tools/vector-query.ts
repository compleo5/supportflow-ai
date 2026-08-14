import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { embed } from 'ai';
import { fastembed } from '@mastra/fastembed';

export const knowledgeBaseTool = createTool({
  id: 'search-knowledge-base',
  description:
    'Search through the customer support knowledge base to find relevant information about product features, billing policies, troubleshooting steps, and FAQs. Use this tool whenever you need to answer a customer question.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant knowledge base articles'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        text: z.string(),
        score: z.number(),
        source: z.string(),
      }),
    ),
  }),
  execute: async ({ query }, { mastra }) => {
    const vectorStore = mastra?.getVector('libsqlVector');
    if (!vectorStore) {
      return { results: [{ text: 'Knowledge base not available.', score: 0, source: 'error' }] };
    }

    const { embedding } = await embed({
      value: query,
      model: fastembed,
    });

    const queryResults = await vectorStore.query({
      indexName: 'support_kb',
      queryVector: embedding,
      topK: 5,
    });

    return {
      results: queryResults.map(r => ({
        text: (r.metadata?.text as string) || '',
        score: r.score,
        source: (r.metadata?.source as string) || 'unknown',
      })),
    };
  },
});
