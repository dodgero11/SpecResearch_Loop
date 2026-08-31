import { IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

export class CreateSpecDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class UpdateNodeDto {
  @IsNotEmpty()
  value!: unknown;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class RecomputeDto {
  @IsOptional()
  nodes?: string[];
}

export class CreateRelatedWorkDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  whatItDid?: string;

  @IsOptional()
  @IsString()
  feedbackType?: string;

  @IsOptional()
  @IsString()
  missingGap?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}
