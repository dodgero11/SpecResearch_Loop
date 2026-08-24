import { DecisionType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class RecordDecisionDto {
  @IsEnum(DecisionType)
  type!: DecisionType;

  @IsString()
  @MinLength(1)
  target!: string;

  @IsObject()
  value!: Record<string, unknown>;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsOptional()
  @IsString()
  example?: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(1)
  answer!: string;
}

export class VerifyClaimDto {
  @IsString()
  @MinLength(1)
  claim!: string;
}
