import { FinalSpecService } from '../src/final-spec.service';

describe('FinalSpecService', () => {
  const prisma = {
    researchProject: { findUnique: jest.fn() },
    specCard: { findMany: jest.fn() },
    judgeIssue: { findMany: jest.fn() },
    decisionLog: { findMany: jest.fn() },
    clarification: { findUnique: jest.fn() },
    specArtifact: { upsert: jest.fn(), findUnique: jest.fn() },
  };
  const projects = { latestSpec: jest.fn(), createSpec: jest.fn() };
  const pdf = { render: jest.fn() };
  const ai = { finalSpec: jest.fn() };
  const service = new FinalSpecService(prisma as never, projects as never, pdf as never, ai as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generate gathers data, calls ai_service, and persists the artifact', async () => {
    prisma.researchProject.findUnique.mockResolvedValue({
      id: 'project-1',
      title: 'My Project',
      latestSpec: { id: 'spec-1', version: 1, data: { relatedWork: [{ paper_title: 'P' }], gapAnalysis: { limitation: 'Gap' }, experimentPlan: { contributions: [{ id: 'c1', label: 'C1', claimEvidence: { claim: 'cl', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r' } }], experiments: [{ name: 'TN1' }], feasibility: {} } } },
    });
    prisma.specCard.findMany.mockResolvedValue([{ type: 'PROBLEM', content: 'Problem' }]);
    prisma.judgeIssue.findMany.mockResolvedValue([{ id: 'issue-1', title: 'Issue' }]);
    prisma.decisionLog.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.clarification.findUnique.mockResolvedValue({ idea: 'Original idea' });
    ai.finalSpec.mockResolvedValue({ output: { markdown_content: '# Spec', spec_json: { title: 'My Project' } } });
    prisma.specArtifact.upsert.mockResolvedValue({});

    const result = await service.generate('project-1');

    expect(ai.finalSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        project_title: 'My Project',
        problem: 'Problem',
        gap: 'Gap',
        contribution: 'C1',
        related_work: [{ paper_title: 'P' }],
        judges_summary: [{ id: 'issue-1', title: 'Issue' }],
      }),
    );
    expect(prisma.specArtifact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { specIterationId_node: { specIterationId: 'spec-1', node: 'final-spec' } } }),
    );
    expect(result).toEqual({ markdownContent: '# Spec', specJson: { title: 'My Project' }, before: 'Original idea', after: 'C1' });
  });

  it('generate throws NotFound when no latest spec exists', async () => {
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1', title: 'T', latestSpec: null });

    await expect(service.generate('project-1')).rejects.toThrow('No latest spec exists for project project-1');
    expect(ai.finalSpec).not.toHaveBeenCalled();
  });

  it('confirm marks the spec as finalConfirmed', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    projects.createSpec.mockResolvedValue({});

    const result = await service.confirm('project-1');

    expect(projects.createSpec).toHaveBeenCalledWith('project-1', { finalConfirmed: true });
    expect(result).toEqual({ saved: true });
  });

  it('exportPdf renders the saved markdown to a PDF', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specArtifact.findUnique.mockResolvedValue({ data: { markdownContent: '# Spec' } });
    pdf.render.mockResolvedValue(Buffer.from('%PDF-1.4'));

    const result = await service.exportPdf('project-1');

    expect(pdf.render).toHaveBeenCalledWith('# Spec');
    expect(result.toString()).toBe('%PDF-1.4');
  });

  it('exportPdf throws NotFound when the final spec has not been generated', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specArtifact.findUnique.mockResolvedValue(null);

    await expect(service.exportPdf('project-1')).rejects.toThrow('Final spec has not been generated yet');
    expect(pdf.render).not.toHaveBeenCalled();
  });

  it('getTemporary synthesizes the 6 items from cards and spec data', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: {
        gapAnalysis: { limitation: 'Chưa tối ưu claim-level' },
        experimentPlan: {
          contributions: [
            { id: 'c1', label: 'C1', claimEvidence: { claim: 'claim1', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r' } },
            { id: 'c2', label: 'C2', claimEvidence: null },
          ],
          experiments: [{ name: 'TN1' }],
          feasibility: { model_name: 'Llama', is_feasible: true },
        },
      },
    });
    prisma.specCard.findMany.mockResolvedValue([{ type: 'PROBLEM', content: 'Problem statement' }]);

    const result = await service.getTemporary('project-1');

    expect(result.problemStatement).toBe('Problem statement');
    expect(result.researchGap).toBe('Chưa tối ưu claim-level');
    expect(result.contributions).toEqual(['C1', 'C2']);
    expect(result.claimEvidenceMatrix).toHaveLength(1);
    expect(result.experimentalProtocol).toEqual([{ name: 'TN1' }]);
    expect(result.computeBudget).toEqual({ model_name: 'Llama', is_feasible: true });
  });

  it('finalize marks the spec as finalized', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    projects.createSpec.mockResolvedValue({});

    const result = await service.finalize('project-1');

    expect(projects.createSpec).toHaveBeenCalledWith('project-1', { finalized: true });
    expect(result).toEqual({ saved: true });
  });
});