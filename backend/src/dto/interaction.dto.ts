import { DecisionType } from '@prisma/client';
import { IsEnum, IsObject, IsString, MinLength } from 'class-validator';

export class RecordDecisionDto {
  @IsEnum(DecisionType)
  type!: DecisionType;

  @IsString()
  @MinLength(1)
  target!: string;

  @IsObject()
  value!: Record<string, unknown>;
}
