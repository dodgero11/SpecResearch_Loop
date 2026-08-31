import { Body, Controller, Param, Post } from '@nestjs/common';
import { ClarifyService } from './clarify.service';
import { ClarifyAnswersDto, ClarifyUnderstandDto } from './dto/clarify.dto';

@Controller('projects/:projectId/clarify')
export class ClarifyController {
  constructor(private readonly clarify: ClarifyService) {}

  @Post('understand')
  understand(@Param('projectId') projectId: string, @Body() body: ClarifyUnderstandDto) {
    return this.clarify.understand(projectId, body.idea, body.feedback);
  }

  @Post('questions')
  questions(@Param('projectId') projectId: string) {
    return this.clarify.questions(projectId);
  }

  @Post('questions/answers')
  answers(@Param('projectId') projectId: string, @Body() body: ClarifyAnswersDto) {
    return this.clarify.answer(projectId, body.answers);
  }
}