import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DecisionService } from './decision.service';
import { RecordDecisionDto } from './dto/interaction.dto';

@Controller('projects/:projectId/decisions')
export class DecisionController {
  constructor(private readonly decisions: DecisionService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.decisions.list(projectId);
  }

  @Post()
  record(@Param('projectId') projectId: string, @Body() body: RecordDecisionDto) {
    return this.decisions.record(projectId, body.type, body.target, body.value);
  }
}
