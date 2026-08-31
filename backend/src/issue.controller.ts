import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResolveIssueDto } from './dto/research.dto';
import { IssueService } from './issue.service';
import { JudgeService } from './judge.service';

@Controller('projects/:projectId')
export class IssueController {
  constructor(
    private readonly issues: IssueService,
    private readonly judges: JudgeService,
  ) {}

  @Post('judges/panel')
  runPanel(@Param('projectId') projectId: string) {
    return this.judges.runPanel(projectId);
  }

  @Get('issues')
  list(@Param('projectId') projectId: string) {
    return this.issues.list(projectId);
  }

  @Post('issues/:issueId/resolve')
  resolve(@Param('projectId') projectId: string, @Param('issueId') issueId: string, @Body() body: ResolveIssueDto) {
    return this.issues.resolve(projectId, issueId, body.choice, body.customChoice);
  }
}