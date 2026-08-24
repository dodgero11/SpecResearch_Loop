import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { toWorkflowResponse } from './api-response';
import { AdvancePhaseDto, StartWorkflowDto } from './dto/workflow.dto';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post()
  start(@Body() body: StartWorkflowDto) {
    return this.workflows.start(body.projectId, body.specIterationId);
  }

  @Get(':runId')
  status(@Param('runId') runId: string) {
    return this.workflows.status(runId).then(toWorkflowResponse);
  }

  @Put(':runId/phase')
  advancePhase(@Param('runId') runId: string, @Body() body: AdvancePhaseDto) {
    return this.workflows.advancePhase(runId, body.phase).then(toWorkflowResponse);
  }

  @Post(':runId/resume')
  @HttpCode(202)
  async resume(@Param('runId') runId: string) {
    await this.workflows.resume(runId);
    const run = await this.workflows.status(runId);
    return toWorkflowResponse(run);
  }
}
