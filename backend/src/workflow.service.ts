import { Injectable, NotFoundException } from '@nestjs/common';
import { ComponentStatus, Prisma, WorkflowStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type WorkflowStep = (step: number, artifacts: Record<string, unknown>) => Promise<Record<string, unknown>>;

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

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

  async startOrResume(runId: string, executeStep: WorkflowStep, finalStep: number): Promise<void> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Workflow run ${runId} was not found`);
    if (run.status === WorkflowStatus.COMPLETED) return;

    const completed = new Set(this.asNumbers(run.completedSteps));
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
        await this.prisma.$transaction([
          this.prisma.componentState.update({ where: { workflowRunId_step: { workflowRunId: runId, step } }, data: { status: ComponentStatus.COMPLETED, output: output as Prisma.InputJsonValue } }),
          this.prisma.workflowRun.update({ where: { id: runId }, data: { currentStep: step + 1, completedSteps: [...completed], artifacts: artifacts as Prisma.InputJsonValue, error: null } }),
        ]);
      } catch (error) {
        await this.prisma.workflowRun.update({ where: { id: runId }, data: { status: WorkflowStatus.FAILED, error: this.errorMessage(error) } });
        throw error;
      }
    }
    await this.prisma.workflowRun.update({ where: { id: runId }, data: { status: WorkflowStatus.COMPLETED, currentStep: finalStep + 1 } });
  }

  private asNumbers(value: Prisma.JsonValue): number[] {
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
  }

  private asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Workflow step failed';
  }
}
