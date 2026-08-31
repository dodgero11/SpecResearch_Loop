import { SpecCardLinkType, SpecCardStatus, SpecCardType } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateSpecCardDto {
  @IsEnum(SpecCardType)
  type!: SpecCardType;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsEnum(SpecCardStatus)
  status?: SpecCardStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class UpdateSpecCardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  // @IsOptional()
  // @IsString()
  // reason?: string;

  @IsOptional()
  @IsEnum(SpecCardStatus)
  status?: SpecCardStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class CreateSpecCardLinkDto {
  @IsString()
  @IsNotEmpty()
  sourceCardId!: string;

  @IsString()
  @IsNotEmpty()
  targetCardId!: string;

  @IsEnum(SpecCardLinkType)
  type!: SpecCardLinkType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class RemoveSpecCardLinkDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}
