import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service';
import { AnswerQuestionDto, CreateQuestionDto } from './dto/interaction.dto';

@Controller('projects/:projectId/confirmations')
export class ConfirmationController {
  constructor(private readonly confirmations: ConfirmationService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.confirmations.list(projectId);
  }

  @Post()
  ask(@Param('projectId') projectId: string, @Body() body: CreateQuestionDto) {
    return this.confirmations.ask(projectId, body.question, body.example);
  }

  @Put('/:questionId')
  answer(@Param('questionId') questionId: string, @Body() body: AnswerQuestionDto) {
    return this.confirmations.answer(questionId, body.answer);
  }
}
