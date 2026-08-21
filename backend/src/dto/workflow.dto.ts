import { IsNotEmpty, IsString } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  specIterationId!: string;
}
