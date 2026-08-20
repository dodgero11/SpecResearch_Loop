import { Body, Controller, Post } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post()
  start(@Body() body: { projectId: string; specIterationId: string }) {
    return this.workflows.start(body.projectId, body.specIterationId);
  }
}
