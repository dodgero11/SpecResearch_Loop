import { DependencyGraphService } from '../src/dependency-graph.service';
import { ExperimentService } from '../src/experiment.service';

describe('ExperimentService', () => {
  const prisma = { specCard: { findMany: jest.fn() }, specArtifact: { upsert: jest.fn() }, $transaction: jest.fn() };
  const projects = { latestSpec: jest.fn(), createSpec: jest.fn() };
  const decisions = { record: jest.fn() };
  const ai = { specExperiment: jest.fn(), singleClaimExperiment: jest.fn() };
  const dependencyGraph = new DependencyGraphService();
  const service = new ExperimentService(prisma as never, projects as never, decisions as never, dependencyGraph, ai as never);

  function mockTransaction() {
    const tx = {
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
    return tx;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generatePlan pairs contributions with claims and stores the plan', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { gapAnalysis: { directions: [{ letter: 'A', selected: true }] } } });
    prisma.specCard.findMany.mockResolvedValue([
      { type: 'PROBLEM', content: 'P' },
      { type: 'GAP_CANDIDATE', content: 'G' },
    ]);
    ai.specExperiment.mockResolvedValue({
      output: {
        contributions: ['C1', 'C2'],
        claims: [
          { claim: 'claim1', baseline: 'b1', metric: 'm1', evidence: 'e1', rejection_condition: 'r1' },
          { claim: 'claim2', baseline: 'b2', metric: 'm2', evidence: 'e2', rejection_condition: 'r2' },
        ],
        experiments: [{ name: 'TN1' }],
        feasibility_estimation: { model_name: 'Llama', is_feasible: true },
      },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    mockTransaction();

    const result = await service.generatePlan('project-1');

    expect(ai.specExperiment).toHaveBeenCalledWith('P', 'G', 'A');
    expect(result.contributions).toHaveLength(2);
    expect(result.contributions[0]).toEqual({
      id: 'contrib-1',
      label: 'C1',
      claimEvidence: { claim: 'claim1', baseline: 'b1', metric: 'm1', evidence: 'e1', rejectionCondition: 'r1' },
    });
    expect(projects.createSpec).toHaveBeenCalledWith('project-1', expect.objectContaining({ experimentPlan: expect.any(Object) }));
  });

  it('addContribution appends a contribution with null claimEvidence', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { experimentPlan: { contributions: [], experiments: [], feasibility: {} } } });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    const tx = mockTransaction();

    const result = await service.addContribution('project-1', 'My contribution');

    expect(result.contribution).toMatchObject({ label: 'My contribution', claimEvidence: null });
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', `contribution:${result.contribution.id}`, { label: 'My contribution' }, tx);
    expect(ai.specExperiment).not.toHaveBeenCalled();
  });

  it('generatePlan sends the direction label (not the letter) to ai_service', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { gapAnalysis: { directions: [{ letter: 'D', label: 'Hướng tự chọn', selected: true }] } } });
    prisma.specCard.findMany.mockResolvedValue([
      { type: 'PROBLEM', content: 'P' },
      { type: 'GAP_CANDIDATE', content: 'G' },
    ]);
    ai.specExperiment.mockResolvedValue({
      output: { contributions: [], claims: [], experiments: [], feasibility_estimation: {} },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    mockTransaction();

    await service.generatePlan('project-1');

    expect(ai.specExperiment).toHaveBeenCalledWith('P', 'G', 'Hướng tự chọn');
  });

  it('updateContribution renames an existing contribution', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { experimentPlan: { contributions: [{ id: 'contrib-1', label: 'C1', claimEvidence: null }], experiments: [], feasibility: {} } },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    const tx = mockTransaction();

    const result = await service.updateContribution('project-1', 'contrib-1', 'C1 mới');

    expect(result.contribution).toMatchObject({ id: 'contrib-1', label: 'C1 mới' });
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', 'contribution:contrib-1', { label: 'C1 mới' }, tx);
    expect(projects.createSpec).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ experimentPlan: expect.objectContaining({ contributions: [{ id: 'contrib-1', label: 'C1 mới', claimEvidence: null }] }) }),
    );
  });

  it('updateContribution throws NotFound for an unknown contribution', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { experimentPlan: { contributions: [], experiments: [], feasibility: {} } },
    });

    await expect(service.updateContribution('project-1', 'nope', 'X')).rejects.toThrow('Contribution nope was not found');
  });

  it('saveClaimEvidence generates an experiment when none is linked', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { experimentPlan: { contributions: [{ id: 'contrib-1', label: 'C1', claimEvidence: null }], experiments: [], feasibility: {} } },
    });
    ai.singleClaimExperiment.mockResolvedValue({ output: { experiment: { name: 'TN', protocol: 'p', expected_outcome: 'o' } } });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    const tx = mockTransaction();

    const result = await service.saveClaimEvidence('project-1', 'contrib-1', {
      claim: 'c', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r',
    });

    expect(ai.singleClaimExperiment).toHaveBeenCalledWith({ claim: 'c', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r' });
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', 'claim-evidence:contrib-1', { claimEvidence: { claim: 'c', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r' } }, tx);
    expect(result.experiment).toEqual({ name: 'TN', protocol: 'p', expected_outcome: 'o', relatedContributionIds: ['contrib-1'] });
    expect(result.needsReview).toBe(false);
  });

  it('saveClaimEvidence flags needsReview when an experiment is already linked', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: {
        experimentPlan: {
          contributions: [{ id: 'contrib-1', label: 'C1', claimEvidence: null }],
          experiments: [{ name: 'TN', relatedContributionIds: ['contrib-1'] }],
          feasibility: {},
        },
      },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    mockTransaction();

    const result = await service.saveClaimEvidence('project-1', 'contrib-1', {
      claim: 'c', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r',
    });

    expect(ai.singleClaimExperiment).not.toHaveBeenCalled();
    expect(result.experiment).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it('saveClaimEvidence throws NotFound for an unknown contribution', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { experimentPlan: { contributions: [], experiments: [], feasibility: {} } },
    });

    await expect(
      service.saveClaimEvidence('project-1', 'nope', { claim: 'c', baseline: 'b', metric: 'm', evidence: 'e', rejectionCondition: 'r' }),
    ).rejects.toThrow('Contribution nope was not found');
  });

  it('feasibility scales tokens and hours by the selected ratio', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: {
        experimentPlan: {
          contributions: [{ id: 'c1' }, { id: 'c2' }],
          experiments: [],
          feasibility: { model_name: 'Llama', seed_prompts_count: 5, candidates_count: 3, vram_needed_gb: 16.5, gpu_time_hours: 2, tokens_estimated: 1000, is_feasible: true, explanation: 'ok' },
        },
      },
    });

    const result = await service.feasibility('project-1', ['c1']);

    expect(result.model).toBe('Llama');
    expect(result.tokens).toBe(500);
    expect(result.hours).toBe(1);
    expect(result.isFeasible).toBe(true);
  });

  it('confirm saves the selected contributions and marks the plan confirmed', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { experimentPlan: { contributions: [{ id: 'c1' }, { id: 'c2' }], experiments: [], feasibility: { gpu_time_hours: 2, tokens_estimated: 1000 } } },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });
    const tx = {
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    const result = await service.confirm('project-1', ['c1']);

    expect(projects.createSpec).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        experimentPlan: expect.objectContaining({
          confirmed: true,
          selectedContributionIds: ['c1'],
          // scaled feasibility is persisted on confirm (Phase 4.7)
          feasibility: expect.objectContaining({ gpu_time_hours: 1, tokens_estimated: 500 }),
        }),
      }),
    );
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', 'experiment-plan', { selectedContributionIds: ['c1'] }, tx);
    expect(result).toEqual({ saved: true });
  });
});