import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ComponentStatus, Prisma, WorkflowPhase, WorkflowStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type WorkflowStep = (step: number, artifacts: Record<string, unknown>) => Promise<Record<string, unknown>>;

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  shouldRetryError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /timeout|timed out|429|rate limit|temporar|network|5\d{2}/i.test(message);
  }

  async start(projectId: string, specIterationId: string): Promise<{ id: string }> {
    const spec = await this.prisma.specIteration.findFirst({ where: { id: specIterationId, projectId } });
    if (!spec) throw new NotFoundException('Spec iteration was not found for this project');
    const run = await this.prisma.workflowRun.create({
      data: {
        projectId,
        specIterationId,
        latestSpecVersion: spec.version,
        completedSteps: [],
        artifacts: {},
      },
      select: { id: true },
    });
    return run;
  }

  async status(runId: string) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Workflow run ${runId} was not found`);
    return run;
  }

  async advancePhase(runId: string, targetPhase: WorkflowPhase) {
    const run = await this.status(runId);
    if (run.status === WorkflowStatus.COMPLETED) throw new BadRequestException('Completed workflows cannot change phase');
    const phases = Object.values(WorkflowPhase);
    const currentIndex = phases.indexOf(run.currentPhase);
    const targetIndex = phases.indexOf(targetPhase);
    if (targetIndex !== currentIndex + 1) {
      throw new BadRequestException(`Workflow phase must advance from ${run.currentPhase} to the next phase`);
    }
    const completedPhases = new Set(this.asPhases(run.completedPhases));
    completedPhases.add(run.currentPhase);
    return this.prisma.workflowRun.update({
      where: { id: runId },
      data: { currentPhase: targetPhase, completedPhases: [...completedPhases] },
    });
  }

  async resume(runId: string): Promise<void> {
    await this.startOrResume(runId, async (step) => ({ step, status: 'completed', source: 'local-adapter' }), 7);
  }

  async startOrResume(runId: string, executeStep: WorkflowStep, finalStep: number): Promise<void> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Workflow run ${runId} was not found`);
    if (run.status === WorkflowStatus.COMPLETED) return;

    const completed = new Set(this.asNumbers(run.completedSteps));
    const completedPhases = new Set(this.asPhases(run.completedPhases));
    const artifacts = this.asRecord(run.artifacts);
    for (let step = run.currentStep; step <= finalStep; step += 1) {
      if (completed.has(step)) continue;
      const existing = await this.prisma.componentState.findUnique({ where: { workflowRunId_step: { workflowRunId: runId, step } } });
      if (existing?.status === ComponentStatus.COMPLETED) {
        completed.add(step);
        if (existing.output) artifacts[`step${step}`] = existing.output;
        continue;
      }
      try {
        await this.prisma.componentState.upsert({
          where: { workflowRunId_step: { workflowRunId: runId, step } },
          create: { workflowRunId: runId, step, status: ComponentStatus.RUNNING },
          update: { status: ComponentStatus.RUNNING },
        });
        const output = await executeStep(step, { ...artifacts });
          artifacts[`step${step}`] = output as Prisma.JsonObject;
        completed.add(step);
        const phase = this.phaseForStep(step);
        completedPhases.add(phase);
        const currentPhase = this.maxPhase(run.currentPhase, phase);
        await this.prisma.$transaction([
          this.prisma.componentState.update({ where: { workflowRunId_step: { workflowRunId: runId, step } }, data: { status: ComponentStatus.COMPLETED, output: output as Prisma.InputJsonValue } }),
          this.prisma.workflowRun.update({ where: { id: runId }, data: { currentStep: step + 1, currentPhase, completedSteps: [...completed], completedPhases: [...completedPhases], artifacts: artifacts as Prisma.InputJsonValue, error: null } }),
        ]);
      } catch (error) {
        const retryable = this.shouldRetryError(error);
        await this.prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: retryable ? WorkflowStatus.FAILED : WorkflowStatus.FAILED,
            error: this.errorMessage(error),
            currentStep: step,
          },
        });
        if (retryable) {
          throw error;
        }
        throw error;
      }
    }
    await this.prisma.workflowRun.update({ where: { id: runId }, data: { status: WorkflowStatus.COMPLETED, currentStep: finalStep + 1, currentPhase: WorkflowPhase.FINAL_SPECIFICATION, completedPhases: Object.values(WorkflowPhase) } });
  }

  private asNumbers(value: Prisma.JsonValue): number[] {
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
  }

  private asPhases(value: Prisma.JsonValue): WorkflowPhase[] {
    const phases = new Set(Object.values(WorkflowPhase));
    return Array.isArray(value) ? value.filter((item): item is WorkflowPhase => typeof item === 'string' && phases.has(item as WorkflowPhase)) : [];
  }

  private phaseForStep(step: number): WorkflowPhase {
    const phases = [WorkflowPhase.IDEA, WorkflowPhase.IDEA_DECOMPOSITION, WorkflowPhase.RESEARCH_AND_GAP, WorkflowPhase.CONTRIBUTION_AND_EXPERIMENT, WorkflowPhase.JUDGES_AND_CONFIRMATION, WorkflowPhase.FINAL_SPECIFICATION];
    return phases[Math.min(step - 1, phases.length - 1)] ?? WorkflowPhase.IDEA;
  }

  private maxPhase(first: WorkflowPhase, second: WorkflowPhase): WorkflowPhase {
    const phases = Object.values(WorkflowPhase);
    return phases[Math.max(phases.indexOf(first), phases.indexOf(second))] ?? WorkflowPhase.IDEA;
  }

  private asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Workflow step failed';
  }
}
