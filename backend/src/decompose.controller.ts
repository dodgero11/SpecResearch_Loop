import { Controller, Param, Post } from '@nestjs/common';
import { DecomposeService } from './decompose.service';

@Controller('projects/:projectId')
export class DecomposeController {
  constructor(private readonly decompose: DecomposeService) {}

  @Post('decompose')
  run(@Param('projectId') projectId: string) {
    return this.decompose.decompose(projectId);
  }
}