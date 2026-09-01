import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContributionDto {
  @IsString()
  @IsNotEmpty()
  label!: string;
}

export class UpdateContributionDto {
  @IsString()
  @IsNotEmpty()
  label!: string;
}

export class ClaimEvidenceDto {
  @IsString()
  @IsNotEmpty()
  claim!: string;

  @IsString()
  baseline!: string;

  @IsString()
  metric!: string;

  @IsString()
  evidence!: string;

  @IsString()
  rejectionCondition!: string;
}

export class FeasibilityDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedContributionIds!: string[];
}

export class ConfirmPlanDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedContributionIds!: string[];
}

export class UpdateClaimEvidenceDto extends ClaimEvidenceDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}