import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateSpecCardDto, CreateSpecCardLinkDto, RemoveSpecCardLinkDto, UpdateSpecCardDto } from './dto/spec-card.dto';
import { SpecCardService } from './spec-card.service';

@Controller('projects/:projectId')
export class SpecCardController {
  constructor(private readonly cards: SpecCardService) {}

  @Get('cards')
  list(@Param('projectId') projectId: string, @Query('specIterationId') specIterationId?: string) {
    return this.cards.list(projectId, specIterationId);
  }

  @Post('cards')
  create(@Param('projectId') projectId: string, @Body() body: CreateSpecCardDto) {
    return this.cards.create(projectId, body, body.idempotencyKey);
  }

  @Put('cards/:cardId')
  update(@Param('projectId') projectId: string, @Param('cardId') cardId: string, @Body() body: UpdateSpecCardDto) {
    return this.cards.update(projectId, cardId, body, body.idempotencyKey);
  }

  @Delete('cards/:cardId')
  remove(@Param('projectId') projectId: string, @Param('cardId') cardId: string, @Query('idempotencyKey') idempotencyKey?: string) {
    return this.cards.remove(projectId, cardId, idempotencyKey);
  }

  @Get('card-links')
  links(@Param('projectId') projectId: string, @Query('specIterationId') specIterationId?: string) {
    return this.cards.list(projectId, specIterationId).then((graph) => ({
      specIterationId: graph.specIterationId,
      specVersion: graph.specVersion,
      links: graph.links,
    }));
  }

  @Post('card-links')
  createLink(@Param('projectId') projectId: string, @Body() body: CreateSpecCardLinkDto) {
    return this.cards.createLink(projectId, body.sourceCardId, body.targetCardId, body.type, body.idempotencyKey);
  }

  @Delete('card-links/:linkId')
  removeLink(@Param('projectId') projectId: string, @Param('linkId') linkId: string, @Body() body: RemoveSpecCardLinkDto) {
    return this.cards.removeLink(projectId, linkId, body.idempotencyKey);
  }
}