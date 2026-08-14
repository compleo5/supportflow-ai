/**
 * Demo Seed Script
 *
 * Runs 6 test emails through the live support pipeline to populate the
 * Review UI with a realistic mix of pending and auto-sent responses.
 *
 * Run: npx tsx src/scripts/seed-demo.ts
 * (Requires Mastra dev server running at localhost:4111)
 */

const API = 'http://localhost:4111/api';

const emails = [
  {
    label: '1/6 — FAQ: password reset (expect: auto-sent, high confidence)',
    emailBody: 'Hi, I forgot my password and cannot log in. How do I reset it?',
    senderEmail: 'alice@startup.io',
    subject: 'Password reset help',
  },
  {
    label: '2/6 — Billing: large refund over guardrail (expect: pending, ~70-80%)',
    emailBody:
      'I signed up for the annual Professional plan 3 weeks ago at $599. The product has not worked reliably since day one — integrations keep failing and dashboard data is wrong. I want a full refund of $599. This is completely unacceptable.',
    senderEmail: 'bob@enterprise-corp.com',
    subject: 'Refund request - $599 annual plan',
  },
  {
    label: '3/6 — Technical: specific error with context (expect: auto-sent or pending)',
    emailBody:
      'Getting a 500 Internal Server Error every time I try to connect our Salesforce integration. It worked fine last week. Error code: SF_AUTH_FAILED. I have tried re-authenticating twice.',
    senderEmail: 'carol@pro-user.com',
    subject: 'Salesforce integration 500 error',
  },
  {
    label: '4/6 — FAQ: pricing question (expect: auto-sent, high confidence)',
    emailBody: 'Can you tell me what features are included in the Professional plan vs the Enterprise plan? We are evaluating which tier is right for our 50-person team.',
    senderEmail: 'dave@example.com',
    subject: 'Plan comparison question',
  },
  {
    label: '5/6 — Escalation: angry enterprise customer (expect: pending or auto-sent as escalation)',
    emailBody:
      'I have now sent FOUR emails about the same data export issue and nobody has resolved it. Our entire analytics workflow is blocked. I am the VP of Operations at a $2M ARR account. If this is not fixed by end of day I am escalating to your CEO and cancelling our contract.',
    senderEmail: 'vp@bigcorp-enterprise.com',
    subject: 'URGENT - 4th email - unresolved data export issue',
  },
  {
    label: '6/6 — Billing: invoice request (expect: auto-sent or pending)',
    emailBody:
      'Could you send me the invoice for our June payment? I need it for our quarterly expense report. The amount was around $199.',
    senderEmail: 'finance@smallbiz.com',
    subject: 'Invoice request - June',
  },
];

async function runEmail(email: (typeof emails)[0]) {
  console.log(`\n→ ${email.label}`);

  const res = await fetch(`${API}/workflows/supportPipeline/start-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputData: {
        emailBody: email.emailBody,
        senderEmail: email.senderEmail,
        subject: email.subject,
      },
    }),
  });

  if (!res.ok) {
    console.error(`  ✗ HTTP ${res.status}: ${await res.text()}`);
    return;
  }

  const data = await res.json();
  const result = data.result;

  if (!result) {
    console.error('  ✗ No result in response');
    return;
  }

  const statusIcon = result.status === 'auto-sent' ? '✓ auto-sent' : '⏳ pending';
  console.log(
    `  ${statusIcon} | confidence: ${result.confidenceScore}% | handler: ${result.handledBy} | id: ${result.id}`,
  );
}

async function main() {
  console.log('SupportFlow AI — Demo Seed');
  console.log('Sending 6 emails through the pipeline...\n');

  // Check server is up
  try {
    const check = await fetch(`${API}/workflows`);
    if (!check.ok) throw new Error(`Server responded ${check.status}`);
  } catch {
    console.error('✗ Cannot reach Mastra dev server at localhost:4111');
    console.error('  Run: npm run dev');
    process.exit(1);
  }

  for (const email of emails) {
    await runEmail(email);
    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nDone! Open http://localhost:3456 to see responses in the Review UI.');
  console.log('Pending responses will appear in the "Pending Review" tab.');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
