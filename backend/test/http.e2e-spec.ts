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
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', database: 'ok' });

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

    const updated = await request(app.getHttpServer())
      .put(`/projects/${projectId}/spec/nodes/gap`)
      .send({ value: 'new gap', idempotencyKey: 'gap-update-1' })
      .expect(200);
    expect(updated.body.version).toBe(2);

    const judge = await request(app.getHttpServer()).post(`/projects/${projectId}/judges/gap`).expect(201);
    expect(judge.body).toEqual(expect.objectContaining({ task: 'gap-judge', verdict: 'REVIEW_REQUIRED' }));

    const verification = await request(app.getHttpServer())
      .post('/verification/claims')
      .send({ claim: 'A test claim' })
      .expect(201);
    expect(verification.body.outcome).toBe('INSUFFICIENT');

    const decision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/decisions`)
      .send({ type: 'ACCEPT', target: 'gap-judge', value: { accepted: true } })
      .expect(201);
    expect(decision.body.type).toBe('ACCEPT');

    const question = await request(app.getHttpServer())
      .post(`/projects/${projectId}/confirmations`)
      .send({ question: 'Accept this gap?' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/confirmations/${question.body.id}`)
      .send({ answer: 'yes' })
      .expect(200);

    const run = await request(app.getHttpServer())
      .post('/workflows')
      .send({ projectId, specIterationId: updated.body.id })
      .expect(201);
    const completed = await request(app.getHttpServer()).post(`/workflows/${run.body.id}/resume`).expect(202);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedSteps).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('rejects invalid project input', async () => {
    await request(app.getHttpServer()).post('/projects').send({ title: '' }).expect(400);
  });
});
