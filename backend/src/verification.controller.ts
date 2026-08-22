import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerifyClaimDto } from './dto/interaction.dto';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@UseGuards(InternalApiKeyGuard)
@Controller('internal/ai/verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('claims')
  verify(@Body() body: VerifyClaimDto) {
    return this.verification.verify(body.claim);
  }
}
