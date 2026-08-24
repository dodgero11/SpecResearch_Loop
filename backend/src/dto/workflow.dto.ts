import { WorkflowPhase } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  specIterationId!: string;
}

export class AdvancePhaseDto {
  @IsEnum(WorkflowPhase)
  phase!: WorkflowPhase;
}
