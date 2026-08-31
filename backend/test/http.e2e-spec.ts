import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// Supertest uses a CommonJS export under the current TypeScript configuration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let specId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    const { ValidationPipe } = await import('@nestjs/common');
    app.enableCors();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (projectId) await prisma.researchProject.delete({ where: { id: projectId } });
    await app.close();
  });

  it('supports the project, spec, judge, verification, and human-decision flow', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        database: 'ok',
        dependencies: { database: 'ok' },
      });

    const project = await request(app.getHttpServer())
      .post('/projects')
      .send({ title: `HTTP test ${Date.now()}` })
      .expect(201);
    projectId = project.body.id;

    const firstSpec = await request(app.getHttpServer())
      .post(`/projects/${projectId}/spec`)
      .set('Idempotency-Key', 'spec-create-1')
      .send({ data: { problem: 'p', gap: 'g', relatedWork: ['r'] }, idempotencyKey: 'spec-create-1' })
      .expect(201);
    specId = firstSpec.body.id;
    expect(firstSpec.body.version).toBe(1);
    expect(firstSpec.body).toEqual(expect.objectContaining({ id: specId, projectId, data: expect.any(Object) }));

    const latest = await request(app.getHttpServer()).get(`/projects/${projectId}/spec/latest`).expect(200);
    expect(latest.body.version).toBe(1);

    const problemCard = await request(app.getHttpServer())
      .post(`/projects/${projectId}/cards`)
      .send({ type: 'PROBLEM', content: 'Manual prompt may be unstable', status: 'CONFIRMED', idempotencyKey: 'problem-card-1' })
      .expect(201);
    expect(problemCard.body.card.type).toBe('PROBLEM');

    const questionCard = await request(app.getHttpServer())
      .post(`/projects/${projectId}/cards`)
      .send({ type: 'RESEARCH_QUESTION', content: 'Do repeated optimization rounds reduce unsupported claims?', idempotencyKey: 'question-card-1' })
      .expect(201);
    const cards = await request(app.getHttpServer()).get(`/projects/${projectId}/cards`).expect(200);
    expect(cards.body.cards).toHaveLength(2);
    const currentProblem = cards.body.cards.find((card: { type: string }) => card.type === 'PROBLEM');
    const currentQuestion = cards.body.cards.find((card: { type: string }) => card.type === 'RESEARCH_QUESTION');
    expect(questionCard.body.specVersion).toBeGreaterThan(problemCard.body.specVersion);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/card-links`)
      .send({ sourceCardId: currentProblem.id, targetCardId: currentQuestion.id, type: 'SUPPORTS', idempotencyKey: 'card-link-1' })
      .expect(201);
    const graph = await request(app.getHttpServer()).get(`/projects/${projectId}/card-links`).expect(200);
    expect(graph.body.links).toHaveLength(1);
    const originalLineageId = currentProblem.lineageId;
    const summary = await request(app.getHttpServer()).get(`/projects/${projectId}/summary`).expect(200);
    expect(summary.body.latestSpec.version).toBe(graph.body.specVersion);
    expect(summary.body.cards).toHaveLength(2);
    expect(summary.body.links).toHaveLength(1);
    const history = await request(app.getHttpServer()).get(`/projects/${projectId}/specs`).expect(200);
    expect(history.body.specs).toHaveLength(4);

    await request(app.getHttpServer()).delete(`/projects/${projectId}/card-links/${graph.body.links[0].id}`).expect(200);
    const afterLinkRemoval = await request(app.getHttpServer()).get(`/projects/${projectId}/cards`).expect(200);
    const removableCard = afterLinkRemoval.body.cards.find((card: { type: string }) => card.type === 'RESEARCH_QUESTION');
    await request(app.getHttpServer()).delete(`/projects/${projectId}/cards/${removableCard.id}`).expect(200);
    const afterCardRemoval = await request(app.getHttpServer()).get(`/projects/${projectId}/cards`).expect(200);
    expect(afterCardRemoval.body.cards).toHaveLength(1);
    expect(afterCardRemoval.body.cards[0].lineageId).toBe(originalLineageId);

    const updated = await request(app.getHttpServer())
      .put(`/projects/${projectId}/spec/nodes/gap`)
      .send({ value: 'new gap', idempotencyKey: 'gap-update-1' })
      .expect(200);
    expect(updated.body.version).toBe(7);

    const invalidations = await request(app.getHttpServer())
      .get(`/projects/${projectId}/invalidations`)
      .expect(200);
    expect(invalidations.body.specVersion).toBe(7);
    expect(invalidations.body.staleNodes).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
    expect(invalidations.body.freshNodes).toEqual(expect.arrayContaining(['problem', 'related_work', 'gap']));

    const recomputed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/recompute`)
      .send({})
      .expect(201);
    expect(recomputed.body.specVersion).toBe(8);
    expect(recomputed.body.recomputedNodes).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
    expect(recomputed.body.judgeResults.length).toBeGreaterThan(0);

    const afterRecompute = await request(app.getHttpServer())
      .get(`/projects/${projectId}/invalidations`)
      .expect(200);
    expect(afterRecompute.body.specVersion).toBe(8);
    expect(afterRecompute.body.staleNodes).toEqual([]);

    const relatedWork = await request(app.getHttpServer())
      .post(`/projects/${projectId}/related-works`)
      .send({ title: 'A user-added paper', sourceUrl: 'https://arxiv.org/abs/2401.99999', idempotencyKey: 'related-work-1' })
      .expect(201);
    expect(relatedWork.body.version).toBe(9);
    expect(relatedWork.body.data.relatedWork).toEqual(expect.arrayContaining([
      expect.objectContaining({ paper_title: 'A user-added paper', source_url: 'https://arxiv.org/abs/2401.99999' }),
    ]));

    const relatedInvalidations = await request(app.getHttpServer())
      .get(`/projects/${projectId}/invalidations`)
      .expect(200);
    expect(relatedInvalidations.body.specVersion).toBe(9);
    expect(relatedInvalidations.body.staleNodes).toEqual(expect.arrayContaining(['gap', 'contribution', 'claim', 'experiment', 'judge']));

    const duplicateRelatedWork = await request(app.getHttpServer())
      .post(`/projects/${projectId}/related-works`)
      .send({ title: 'A user-added paper', sourceUrl: 'https://arxiv.org/abs/2401.99999' })
      .expect(201);
    expect(duplicateRelatedWork.body.version).toBe(9);

    const judge = await request(app.getHttpServer())
      .post(`/internal/ai/projects/${projectId}/judges/gap`)
      .set('x-api-key', 'local-dev-key')
      .expect(201);
    expect(judge.body).toEqual(expect.objectContaining({ task: 'gap-judge', verdict: 'REVIEW_REQUIRED' }));

    const panel = await request(app.getHttpServer())
      .post(`/internal/ai/projects/${projectId}/judges/panel`)
      .set('x-api-key', 'local-dev-key')
      .expect(201);
    expect(panel.body.status).toBe('COMPLETED');
    expect(panel.body.judges).toHaveLength(5);

    const decision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/decisions`)
      .send({ type: 'ACCEPT', target: 'gap-judge', value: { accepted: true } })
      .expect(201);
    expect(decision.body.type).toBe('ACCEPT');

    const run = await request(app.getHttpServer())
      .post('/workflows')
      .send({ projectId, specIterationId: updated.body.id })
      .expect(201);
    const phase = await request(app.getHttpServer())
      .put(`/workflows/${run.body.id}/phase`)
      .send({ phase: 'IDEA_DECOMPOSITION' })
      .expect(200);
    expect(phase.body.phase).toBe('IDEA_DECOMPOSITION');
    await request(app.getHttpServer())
      .put(`/workflows/${run.body.id}/phase`)
      .send({ phase: 'FINAL_SPECIFICATION' })
      .expect(400);
    const completed = await request(app.getHttpServer()).post(`/workflows/${run.body.id}/resume`).expect(202);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.phase).toBe('FINAL_SPECIFICATION');
    expect(completed.body.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('rejects invalid project input', async () => {
    await request(app.getHttpServer()).post('/projects').send({ title: '' }).expect(400);
  });

  it('lists all projects with their latest spec summary', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .send({ title: `List test ${Date.now()}` })
      .expect(201);

    const list = await request(app.getHttpServer()).get('/projects').expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    const entry = list.body.find((p: { id: string }) => p.id === created.body.id);
    expect(entry).toBeDefined();
    expect(entry).toEqual(
      expect.objectContaining({
        id: created.body.id,
        title: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        latestSpec: null,
      }),
    );

    await prisma.researchProject.delete({ where: { id: created.body.id } });
  });
});
