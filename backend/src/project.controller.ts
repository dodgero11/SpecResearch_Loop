import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto, CreateSpecDto, UpdateNodeDto } from './dto/project.dto';
import { toSpecResponse } from './api-response';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post()
  create(@Body() body: CreateProjectDto): Promise<{ id: string; title: string }> {
    return this.projects.create(body.title);
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
}
