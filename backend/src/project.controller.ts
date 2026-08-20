import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post()
  create(@Body() body: { title: string }): Promise<{ id: string; title: string }> {
    return this.projects.create(body.title);
  }

  @Get(':projectId/spec/latest')
  latest(@Param('projectId') projectId: string) {
    return this.projects.latestSpec(projectId);
  }

  @Post(':projectId/spec')
  createSpec(@Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    return this.projects.createSpec(projectId, body);
  }

  @Put(':projectId/spec/nodes/:node')
  updateNode(@Param('projectId') projectId: string, @Param('node') node: string, @Body() body: { value: unknown }) {
    return this.projects.updateNode(projectId, node, body.value);
  }
}
