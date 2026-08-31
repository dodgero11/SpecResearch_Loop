import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ResolveConflictDto, SelectDirectionDto } from './dto/research.dto';
import { ResearchService } from './research.service';

@Controller('projects/:projectId')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Get('related-works')
  relatedWorks(@Param('projectId') projectId: string) {
    return this.research.getRelatedWorks(projectId);
  }

  @Post('gap-analysis')
  gapAnalysis(@Param('projectId') projectId: string) {
    return this.research.gapAnalysis(projectId);
  }

  @Post('gap-analysis/select')
  selectDirection(@Param('projectId') projectId: string, @Body() body: SelectDirectionDto) {
    return this.research.selectDirection(projectId, body.letter);
  }

  @Post('conflicts/check')
  checkConflicts(@Param('projectId') projectId: string) {
    return this.research.checkConflicts(projectId);
  }

  @Post('conflicts/:conflictId/resolve')
  resolveConflict(@Param('projectId') projectId: string, @Param('conflictId') conflictId: string, @Body() body: ResolveConflictDto) {
    return this.research.resolveConflict(projectId, conflictId, body.choice, body.customResolution);
  }
}