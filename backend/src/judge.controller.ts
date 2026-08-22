import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JudgeService } from './judge.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@UseGuards(InternalApiKeyGuard)
@Controller('internal/ai/projects/:projectId/judges')
export class JudgeController {
  constructor(private readonly judges: JudgeService) {}

  @Post('gap')
  runGapJudge(@Param('projectId') projectId: string) {
    return this.judges.runGapJudge(projectId);
  }

  @Post('panel')
  runPanel(@Param('projectId') projectId: string) {
    return this.judges.runPanel(projectId);
  }
}
