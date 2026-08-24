import { SpecIteration, WorkflowPhase, WorkflowRun } from '@prisma/client';

export type ProjectResponse = { id: string; title: string };
export type SpecResponse = { id: string; projectId: string; version: number; data: unknown; createdAt: string };
export type WorkflowResponse = { id: string; projectId: string; specIterationId: string; currentStep: number; phase: WorkflowPhase; completedSteps: unknown; completedPhases: unknown; artifacts: unknown; latestSpecVersion: number; status: string; error: string | null };

export function toProjectResponse(project: ProjectResponse): ProjectResponse {
  return project;
}

export function toSpecResponse(spec: SpecIteration): SpecResponse {
  return {
    id: spec.id,
    projectId: spec.projectId,
    version: spec.version,
    data: spec.data,
    createdAt: spec.createdAt.toISOString(),
  };
}

export function toWorkflowResponse(run: WorkflowRun): WorkflowResponse {
  return {
    id: run.id,
    projectId: run.projectId,
    specIterationId: run.specIterationId,
    currentStep: run.currentStep,
    phase: run.currentPhase,
    completedSteps: run.completedSteps,
    completedPhases: run.completedPhases,
    artifacts: run.artifacts,
    latestSpecVersion: run.latestSpecVersion,
    status: run.status,
    error: run.error,
  };
}
