// src/quiz/dto/create-question.dto.ts
import {
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { QuizCategory } from '../schemas/quiz-question.schema';
import { Type } from 'class-transformer';

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  value: string; // a, b, c, d
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsEnum(QuizCategory)
  category: QuizCategory;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];
}
