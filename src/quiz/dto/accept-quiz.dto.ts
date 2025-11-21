import { IsMongoId } from 'class-validator';

// src/quiz/dto/accept-quiz.dto.ts
export class AcceptQuizDto {
  @IsMongoId()
  sessionId: string;
}
