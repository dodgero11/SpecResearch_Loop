import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ClarifyUnderstandDto {
  @IsString()
  @IsNotEmpty()
  idea!: string;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class ClarifyAnswerItemDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsInt()
  @Min(0)
  selectedIndex!: number;

  @IsOptional()
  @IsString()
  customAnswer?: string;
}

export class ClarifyAnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ClarifyAnswerItemDto)
  answers!: ClarifyAnswerItemDto[];
}