import { embed } from 'ai';
import { fastembed } from '@mastra/fastembed';
import type { LibSQLVector } from '@mastra/libsql';
import type { ResponseRecord } from './response-store';

const INDEX_NAME = 'support_kb';

/**
 * Learning Loop — processes reviewed responses and feeds them back into the knowledge base.
 *
 * - Approved responses → stored as verified Q&A pairs in the KB.
 * - Edited responses → stored with the corrected answer (higher quality).
 * - Rejected responses → logged for pattern analysis (not added to KB).
 */
export async function processReviewedResponse(
  record: ResponseRecord,
  vectorStore: LibSQLVector,
): Promise<{ action: string; chunksAdded: number }> {
  if (record.status === 'rejected') {
    // Rejected responses are logged but not added to KB.
    // In production, we'd track rejection patterns to identify KB gaps.
    console.log(`[Learning Loop] Rejected response ${record.id} — logged for pattern analysis`);
    return { action: 'logged_rejection', chunksAdded: 0 };
  }

  if (record.status !== 'approved' && record.status !== 'edited') {
    return { action: 'skipped', chunksAdded: 0 };
  }

  // Build a Q&A pair document
  const answer = record.status === 'edited' ? (record.editedReply || record.emailReply) : record.emailReply;
  const qaText = `## Verified Support Answer

**Customer Question:**
${record.emailBody}

**Approved Answer:**
${answer}

**Category:** ${record.classification}
**Confidence:** ${record.confidenceScore}%
${record.feedback ? `**Reviewer Feedback:** ${record.feedback}` : ''}`;

  // Embed the Q&A pair
  const { embedding } = await embed({
    value: qaText,
    model: fastembed,
  });

  // Store in the KB vector store
  await vectorStore.upsert({
    indexName: INDEX_NAME,
    vectors: [embedding],
    metadata: [
      {
        text: qaText,
        source: 'learning-loop',
        file: `review-${record.id}`,
        classification: record.classification,
        reviewStatus: record.status,
        originalConfidence: record.confidenceScore,
        chunkIndex: 0,
      },
    ],
  });

  const action = record.status === 'edited' ? 'added_correction' : 'added_verified';
  console.log(`[Learning Loop] ${action} — response ${record.id} added to KB`);

  return { action, chunksAdded: 1 };
}
