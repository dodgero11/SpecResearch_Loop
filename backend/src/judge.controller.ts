import { Controller, Param, Post } from '@nestjs/common';
import { JudgeService } from './judge.service';

@Controller('projects/:projectId/judges')
export class JudgeController {
  constructor(private readonly judges: JudgeService) {}

  @Post('gap')
  runGapJudge(@Param('projectId') projectId: string) {
    return this.judges.runGapJudge(projectId);
  }
}
