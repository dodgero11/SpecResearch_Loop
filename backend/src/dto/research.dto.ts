import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveConflictDto {
  @IsIn(['A', 'B', 'C', 'D'])
  choice!: string;

  @IsOptional()
  @IsString()
  customResolution?: string;
}

export class ResolveIssueDto {
  @IsString()
  @IsNotEmpty()
  choice!: string;

  @IsOptional()
  @IsString()
  customChoice?: string;
}

export class SelectDirectionDto {
  @IsIn(['A', 'B', 'C', 'D'])
  letter!: string;
}