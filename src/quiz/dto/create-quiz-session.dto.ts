// src/quiz/dto/create-quiz-session.dto.ts
import { IsMongoId } from 'class-validator';

export class CreateQuizSessionDto {
  @IsMongoId()
  matchId: string;
}
