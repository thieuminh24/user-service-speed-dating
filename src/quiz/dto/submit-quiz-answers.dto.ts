// src/quiz/dto/submit-quiz-answers.dto.ts
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsMongoId,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuizAnswerDto {
  @IsMongoId()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  selectedOption: string; // a, b, c, or d
}

export class SubmitQuizAnswersDto {
  @IsOptional()
  @IsMongoId()
  sessionId: string;

  @IsArray()
  @ArrayMinSize(10)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
