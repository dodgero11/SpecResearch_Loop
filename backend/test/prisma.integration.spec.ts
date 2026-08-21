import { PrismaClient } from '@prisma/client';

describe('Prisma persistence integration', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/spec_research_loop?schema=public' } },
  });
  let projectId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const project = await prisma.researchProject.create({ data: { title: 'integration-test' } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.researchProject.delete({ where: { id: projectId } });
    await prisma.$disconnect();
  });

  it('enforces immutable project version uniqueness and component step uniqueness', async () => {
    const first = await prisma.specIteration.create({ data: { projectId, version: 1, data: { gap: 'one' } } });
    await expect(prisma.specIteration.create({ data: { projectId, version: 1, data: { gap: 'duplicate' } } })).rejects.toMatchObject({ code: 'P2002' });

    const run = await prisma.workflowRun.create({
      data: { projectId, specIterationId: first.id, completedSteps: [], artifacts: {}, latestSpecVersion: 1 },
    });
    await prisma.componentState.create({ data: { workflowRunId: run.id, step: 7 } });
    await expect(prisma.componentState.create({ data: { workflowRunId: run.id, step: 7 } })).rejects.toMatchObject({ code: 'P2002' });
  });
});
