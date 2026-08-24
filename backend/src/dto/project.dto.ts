import { IsNotEmpty, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

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
