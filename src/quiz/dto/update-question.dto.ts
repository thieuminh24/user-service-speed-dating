// src/quiz/dto/update-question.dto.ts
import {
  IsOptional,
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { QuizCategory } from '../schemas/quiz-question.schema';
import { Type } from 'class-transformer';
import { QuestionOptionDto } from './create-question.dto';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @IsOptional()
  @IsEnum(QuizCategory)
  category?: QuizCategory;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
