import { Body, Controller, Post } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerifyClaimDto } from './dto/interaction.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('claims')
  verify(@Body() body: VerifyClaimDto) {
    return this.verification.verify(body.claim);
  }
}
