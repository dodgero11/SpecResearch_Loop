import { ContextBuilderService } from '../src/context-builder.service';

describe('ContextBuilderService', () => {
  function makeService(data: Record<string, unknown>, cards: Array<{ type: string; content: string }> = []) {
    const projects = {
      latestSpec: jest.fn().mockResolvedValue({ version: 4, data }),
    };
    const prisma = {
      specCard: { findMany: jest.fn().mockResolvedValue(cards) },
    };
    const service = new ContextBuilderService(projects as never, prisma as never);
    return { service, projects, prisma };
  }

  it('resolves the latest spec and only includes allowlisted Gap Judge fields', async () => {
    const { service, projects } = makeService(
      { gapAnalysis: { limitation: 'g' }, relatedWork: ['r'], experimentPlan: { contributions: [], experiments: [] } },
      [{ type: 'PROBLEM', content: 'p' }],
    );

    await expect(service.build('gap-judge', 'project-1')).resolves.toEqual({
      specVersion: 4,
      inputContext: { problem: 'p', gap: 'g', relatedWork: ['r'] },
    });
    expect(projects.latestSpec).toHaveBeenCalledWith('project-1');
  });

  it('only includes evidence-related fields for the Evidence Judge', async () => {
    const { service } = makeService(
      { relatedWork: ['r'], experimentPlan: { contributions: [{ id: 'c1', label: 'C1', claimEvidence: { claim: 'c' } }], experiments: [] } },
      [{ type: 'EVIDENCE', content: 'e' }],
    );

    await expect(service.build('evidence-judge', 'project-1')).resolves.toEqual({
      specVersion: 4,
      inputContext: { claims: [{ claim: 'c' }], evidence: ['e'], relatedWork: ['r'] },
    });
  });

  it('passes the full spec to the Conference Readiness Judge', async () => {
    const { service } = makeService(
      { gapAnalysis: { limitation: 'g' }, relatedWork: ['r'], experimentPlan: { contributions: [{ id: 'c1', label: 'C1', claimEvidence: null }], experiments: [{ name: 'TN1' }] } },
      [{ type: 'PROBLEM', content: 'p' }],
    );

    const ctx = await service.build('conference-readiness-judge', 'project-1');
    expect(ctx.inputContext).toEqual(expect.objectContaining({ problem: 'p', gap: 'g', contribution: 'C1' }));
  });

  it('buildPanel merges the full context for a single panel call', async () => {
    const { service } = makeService(
      { gapAnalysis: { limitation: 'g' }, relatedWork: ['r'], experimentPlan: { contributions: [{ id: 'c1', label: 'C1', claimEvidence: { claim: 'c' } }], experiments: [{ name: 'TN1' }] } },
      [{ type: 'PROBLEM', content: 'p' }, { type: 'EVIDENCE', content: 'e' }],
    );

    const ctx = await service.buildPanel('project-1');
    expect(ctx.specVersion).toBe(4);
    expect(ctx.inputContext).toEqual(
      expect.objectContaining({
        problem: 'p',
        gap: 'g',
        contribution: 'C1',
        claims: [{ claim: 'c' }],
        experiments: [{ name: 'TN1' }],
        evidence: ['e'],
        relatedWork: ['r'],
      }),
    );
  });
});
