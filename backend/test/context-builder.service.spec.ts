import { ContextBuilderService } from '../src/context-builder.service';

describe('ContextBuilderService', () => {
  it('resolves the latest spec and only includes allowlisted Gap Judge fields', async () => {
    const projects = {
      latestSpec: jest.fn().mockResolvedValue({
        version: 4,
        data: { problem: 'p', gap: 'g', relatedWork: ['r'], claims: ['secret'] },
      }),
    };
    const service = new ContextBuilderService(projects as never);

    await expect(service.build('gap-judge', 'project-1')).resolves.toEqual({
      specVersion: 4,
      inputContext: { problem: 'p', gap: 'g', relatedWork: ['r'] },
    });
    expect(projects.latestSpec).toHaveBeenCalledWith('project-1');
  });

  it('only includes evidence-related fields for the Evidence Judge', async () => {
    const projects = {
      latestSpec: jest.fn().mockResolvedValue({
        version: 4,
        data: { claims: ['c'], evidence: ['e'], relatedWork: ['r'], problem: 'p' },
      }),
    };
    const service = new ContextBuilderService(projects as never);

    await expect(service.build('evidence-judge', 'project-1')).resolves.toEqual({
      specVersion: 4,
      inputContext: { claims: ['c'], evidence: ['e'], relatedWork: ['r'] },
    });
  });

  it('passes the full spec to the Conference Readiness Judge', async () => {
    const projects = {
      latestSpec: jest.fn().mockResolvedValue({
        version: 2,
        data: { problem: 'p', gap: 'g', contribution: 'c', claims: [], experiment: {} },
      }),
    };
    const service = new ContextBuilderService(projects as never);

    const ctx = await service.build('conference-readiness-judge', 'project-1');
    expect(ctx.inputContext).toEqual(expect.objectContaining({ problem: 'p', gap: 'g', contribution: 'c' }));
  });
});
