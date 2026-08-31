import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { FinalSpecService } from './final-spec.service';

@Controller('projects/:projectId')
export class FinalSpecController {
  constructor(private readonly finalSpec: FinalSpecService) {}

  @Get('spec/temporary')
  temporary(@Param('projectId') projectId: string) {
    return this.finalSpec.getTemporary(projectId);
  }
  
  @Post('spec/finalize')
  finalize(@Param('projectId') projectId: string) {
    return this.finalSpec.finalize(projectId);
  }

  @Post('final-spec')
  generate(@Param('projectId') projectId: string) {
    return this.finalSpec.generate(projectId);
  }

  @Post('final-spec/confirm')
  confirm(@Param('projectId') projectId: string) {
    return this.finalSpec.confirm(projectId);
  }

  @Post('final-spec/export-pdf')
  async exportPdf(@Param('projectId') projectId: string, @Res() res: Response) {
    const pdf = await this.finalSpec.exportPdf(projectId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="spec.pdf"');
    res.send(pdf);
  }
}