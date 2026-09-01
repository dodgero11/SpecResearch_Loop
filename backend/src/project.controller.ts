import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ProjectService } from './project.service';
import { RecomputeService } from './recompute.service';
import { CreateProjectDto, CreateRelatedWorkDto, CreateSpecDto, RecomputeDto, UpdateNodeDto } from './dto/project.dto';
import { toSpecResponse } from './api-response';

@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly recomputeService: RecomputeService,
  ) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Post()
  create(@Body() body: CreateProjectDto): Promise<{ id: string; title: string }> {
    return this.projects.create(body.title);
  }

  @Get(':projectId/summary')
  summary(@Param('projectId') projectId: string) {
    return this.projects.summary(projectId);
  }

  @Get(':projectId/specs')
  history(@Param('projectId') projectId: string) {
    return this.projects.history(projectId);
  }

  @Get(':projectId/spec/latest')
  latest(@Param('projectId') projectId: string) {
    return this.projects.latestSpec(projectId).then(toSpecResponse);
  }

  @Post(':projectId/spec')
  createSpec(@Param('projectId') projectId: string, @Body() body: CreateSpecDto) {
    return this.projects.createSpec(projectId, body.data, body.idempotencyKey).then(toSpecResponse);
  }

  @Put(':projectId/spec/nodes/:node')
  updateNode(@Param('projectId') projectId: string, @Param('node') node: string, @Body() body: UpdateNodeDto) {
    return this.projects.updateNode(projectId, node, body.value, body.idempotencyKey).then(toSpecResponse);
  }

  @Post(':projectId/related-works')
  addRelatedWork(@Param('projectId') projectId: string, @Body() body: CreateRelatedWorkDto) {
    return this.projects.addRelatedWork(
      projectId,
      {
        title: body.title,
        sourceUrl: body.sourceUrl,
        year: body.year,
        whatItDid: body.whatItDid,
        feedbackType: body.feedbackType,
        missingGap: body.missingGap,
        sourceType: body.sourceType,
      },
      body.idempotencyKey,
    ).then(toSpecResponse);
  }

  @Delete(':projectId/related-works/:workId')
  removeRelatedWork(@Param('projectId') projectId: string, @Param('workId') workId: string) {
    return this.projects.removeRelatedWork(projectId, workId).then(toSpecResponse);
  }

  @Get(':projectId/invalidations')
  invalidations(@Param('projectId') projectId: string) {
    return this.projects.getInvalidations(projectId);
  }

  @Post(':projectId/recompute')
  recompute(@Param('projectId') projectId: string, @Body() body: RecomputeDto) {
    return this.recomputeService.recompute(projectId, body.nodes);
  }
}
