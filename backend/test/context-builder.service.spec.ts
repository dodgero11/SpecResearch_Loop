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
});
