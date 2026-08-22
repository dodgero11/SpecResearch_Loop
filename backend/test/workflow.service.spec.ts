import { ComponentStatus, WorkflowStatus } from '@prisma/client';
import { WorkflowService } from '../src/workflow.service';

describe('WorkflowService', () => {
  it('resumes at the persisted current step without rerunning completed steps', async () => {
    const executeStep = jest.fn().mockResolvedValue({ judged: true });
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      workflowRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run-1', currentStep: 7, completedSteps: [1, 2, 3, 4, 5, 6], artifacts: {}, status: WorkflowStatus.FAILED,
        }),
        update,
      },
      componentState: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new WorkflowService(prisma as never);

    await service.startOrResume('run-1', executeStep, 7);

    expect(executeStep).toHaveBeenCalledTimes(1);
    expect(executeStep).toHaveBeenCalledWith(7, {});
    expect(prisma.workflowRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currentStep: 8, status: WorkflowStatus.COMPLETED }),
    }));
    expect(ComponentStatus.COMPLETED).toBe('COMPLETED');
  });

  it('classifies transient provider failures as retryable and malformed errors as terminal', () => {
    const service = new WorkflowService({} as never);

    expect(service.shouldRetryError(new Error('Request timed out'))).toBe(true);
    expect(service.shouldRetryError(new Error('429 Too Many Requests'))).toBe(true);
    expect(service.shouldRetryError(new Error('bad request'))).toBe(false);
    expect(service.shouldRetryError(new Error('Unauthorized'))).toBe(false);
  });
});
