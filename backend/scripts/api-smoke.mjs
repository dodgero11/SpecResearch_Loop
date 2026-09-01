// API smoke test for SpecResearch Loop backend.
// Usage: node scripts/api-smoke.mjs [baseUrl] [apiKey]
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://localhost:3000';
const apiKey = process.argv[3] ?? 'local-dev-key';

let seq = 0;
const idempotency = (name) => `smoke-${name}-${Date.now()}-${seq++}`;

async function req(method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

function ok(res, expect, label) {
  try {
    if (expect !== undefined) assert.equal(res.status, expect);
    console.log(`PASS ${label} → ${res.status}`);
  } catch (e) {
    console.error(`FAIL ${label} → ${res.status} (expected ${expect}) body: ${JSON.stringify(res.body)}`);
    throw e;
  }
}

// 1. Health
let res = await req('GET', '/health');
ok(res, 200, 'GET /health');

// 2. Create project
res = await req('POST', '/projects', { body: { title: `Smoke ${Date.now()}` } });
ok(res, 201, 'POST /projects');
const projectId = res.body.id;

// 3. Create spec
res = await req('POST', `/projects/${projectId}/spec`, { body: {
  data: { idea: 'Optimize prompts', problem: 'Reproducibility', relatedWork: ['A'] },
  idempotencyKey: idempotency('spec'),
}});
ok(res, 201, 'POST /projects/:id/spec');
const specId = res.body.id;

// 4. Read latest spec
res = await req('GET', `/projects/${projectId}/spec/latest`);
ok(res, 200, 'GET /projects/:id/spec/latest');

// 5. Create cards
res = await req('POST', `/projects/${projectId}/cards`, { body: { type: 'PROBLEM', content: 'Manual prompts unstable', status: 'CONFIRMED', idempotencyKey: idempotency('card1') } });
ok(res, 201, 'POST /projects/:id/cards (PROBLEM)');

res = await req('POST', `/projects/${projectId}/cards`, { body: { type: 'CLAIM', content: 'Method reduces unsupported claims', idempotencyKey: idempotency('card2') } });
ok(res, 201, 'POST /projects/:id/cards (CLAIM)');

// Cards are immutable-versioned; re-fetch latest version IDs before linking.
res = await req('GET', `/projects/${projectId}/cards`);
ok(res, 200, 'GET /projects/:id/cards');
const latestProblem = res.body.cards.find((c) => c.type === 'PROBLEM');
const latestClaim = res.body.cards.find((c) => c.type === 'CLAIM');
assert.ok(latestProblem && latestClaim, 'found latest PROBLEM and CLAIM cards');
const problemCardId = latestProblem.id;
const claimCardId = latestClaim.id;

// 6. List cards
res = await req('GET', `/projects/${projectId}/cards`);
ok(res, 200, 'GET /projects/:id/cards');

// 7. Create card link
res = await req('POST', `/projects/${projectId}/card-links`, { body: { sourceCardId: problemCardId, targetCardId: claimCardId, type: 'SUPPORTS', idempotencyKey: idempotency('link') } });
ok(res, 201, 'POST /projects/:id/card-links');
const linkId = res.body.link.id;

// 8. List card links
res = await req('GET', `/projects/${projectId}/card-links`);
ok(res, 200, 'GET /projects/:id/card-links');

// 9. Update a card (triggers invalidation) — re-fetch latest claim first (link created a new version)
res = await req('GET', `/projects/${projectId}/cards`);
const latestClaim2 = res.body.cards.find((c) => c.type === 'CLAIM');
res = await req('PUT', `/projects/${projectId}/cards/${latestClaim2.id}`, { body: { content: 'Refined claim', idempotencyKey: idempotency('card-update') } });
ok(res, 200, 'PUT /projects/:id/cards/:cardId');

// 10. Update spec node gap
res = await req('PUT', `/projects/${projectId}/spec/nodes/gap`, { body: { value: 'Existing tooling ignores claim-level feedback', idempotencyKey: idempotency('gap') } });
ok(res, 200, 'PUT /projects/:id/spec/nodes/gap');

// 11. Invalidations
res = await req('GET', `/projects/${projectId}/invalidations`);
ok(res, 200, 'GET /projects/:id/invalidations');
assert.ok(Array.isArray(res.body.staleNodes), 'staleNodes is an array');
console.log('   staleNodes =', JSON.stringify(res.body.staleNodes));

// 12. Judges (internal, authenticated)
res = await req('POST', `/internal/ai/projects/${projectId}/judges/gap`, { headers: { 'x-api-key': apiKey } });
ok(res, 201, 'POST /internal/ai/projects/:id/judges/gap');

// 13. Panel (internal)
res = await req('POST', `/internal/ai/projects/${projectId}/judges/panel`, { headers: { 'x-api-key': apiKey } });
ok(res, 201, 'POST /internal/ai/projects/:id/judges/panel');
assert.equal(res.body.judges.length, 5, 'panel returns 5 judges');
const types = res.body.judges.map((j) => j.type).sort();
const expected = ['conference-readiness', 'contribution', 'evidence', 'experiment', 'gap'].sort();
assert.deepEqual(types, expected, 'panel judge types match original set');
console.log('   judges =', JSON.stringify(types));

// 14. Decision
res = await req('POST', `/projects/${projectId}/decisions`, { body: { type: 'ACCEPT', target: 'gap-judge', value: { accepted: true } } });
ok(res, 201, 'POST /projects/:id/decisions');

// 16. List decisions
res = await req('GET', `/projects/${projectId}/decisions`);
ok(res, 200, 'GET /projects/:id/decisions');

// 17. Clarify understand
res = await req('POST', `/projects/${projectId}/clarify/understand`, { body: { idea: 'Optimize prompts' } });
ok(res, 201, 'POST /projects/:id/clarify/understand');

// 18. Clarify questions
res = await req('POST', `/projects/${projectId}/clarify/questions`, { body: {} });
ok(res, 201, 'POST /projects/:id/clarify/questions');
const questionId = res.body.questions?.[0]?.id;

// 18b. Clarify answers (batch)
if (questionId) {
  res = await req('POST', `/projects/${projectId}/clarify/questions/answers`, { body: { answers: [{ questionId, selectedIndex: 0 }] } });
  ok(res, 201, 'POST /projects/:id/clarify/questions/answers');
}

// 19. Workflow start
res = await req('POST', '/workflows', { body: { projectId, specIterationId: specId } });
ok(res, 201, 'POST /workflows');
const runId = res.body.id;

// 20. Workflow status
res = await req('GET', `/workflows/${runId}`);
ok(res, 200, 'GET /workflows/:runId');

// 21. Advance phase
res = await req('PUT', `/workflows/${runId}/phase`, { body: { phase: 'IDEA_DECOMPOSITION' } });
ok(res, 200, 'PUT /workflows/:runId/phase');

// 22. Resume
res = await req('POST', `/workflows/${runId}/resume`);
ok(res, 202, 'POST /workflows/:runId/resume');

// 23. Summary
res = await req('GET', `/projects/${projectId}/summary`);
ok(res, 200, 'GET /projects/:id/summary');

// 24. Recompute (after invalidations)
res = await req('POST', `/projects/${projectId}/recompute`, { body: { nodes: ['gap'] } });
ok(res, 201, 'POST /projects/:id/recompute');
console.log('   recomputed =', JSON.stringify(res.body.recomputedNodes));

// 25. History
res = await req('GET', `/projects/${projectId}/specs`);
ok(res, 200, 'GET /projects/:id/specs');

// 26. Invalidations after recompute
res = await req('GET', `/projects/${projectId}/invalidations`);
ok(res, 200, 'GET /projects/:id/invalidations (after recompute)');

// 27. Add related work
res = await req('POST', `/projects/${projectId}/related-works`, { body: { title: 'Smoke related paper', sourceUrl: 'https://arxiv.org/abs/2401.99999', idempotencyKey: idempotency('rw') } });
ok(res, 201, 'POST /projects/:id/related-works');
const rwVersion = res.body.version;
assert.ok(Array.isArray(res.body.data.relatedWork), 'relatedWork is an array');
assert.ok(res.body.data.relatedWork.some((r) => r.paper_title === 'Smoke related paper'), 'related work appended');

// 28. Related work invalidates downstream
res = await req('GET', `/projects/${projectId}/invalidations`);
ok(res, 200, 'GET /projects/:id/invalidations (after related work)');
assert.ok(res.body.staleNodes.includes('gap'), 'gap stale after related work add');

// 29. Duplicate related work is a no-op (no version bump)
res = await req('POST', `/projects/${projectId}/related-works`, { body: { title: 'Smoke related paper', sourceUrl: 'https://arxiv.org/abs/2401.99999' } });
ok(res, 201, 'POST /projects/:id/related-works (duplicate)');
assert.equal(res.body.version, rwVersion, 'duplicate does not bump version');

// 30. Delete related work by id
const rwId = res.body.data.relatedWork.find((r) => r.paper_title === 'Smoke related paper').id;
assert.ok(rwId, 'related work has an id');
res = await req('DELETE', `/projects/${projectId}/related-works/${rwId}`);
ok(res, 201, 'DELETE /projects/:id/related-works/:workId');
assert.ok(!res.body.data.relatedWork.some((r) => r.id === rwId), 'related work removed');

console.log('\nALL API SMOKE TESTS PASSED');
