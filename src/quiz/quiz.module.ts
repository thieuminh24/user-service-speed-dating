// src/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizController } from './quiz.controller';
import { QuizAdminController } from './quiz-admin.controller';
import { QuizService } from './quiz.service';
import { QuizAdminService } from './quiz-admin.service';
import {
  QuizQuestion,
  QuizQuestionSchema,
} from './schemas/quiz-question.schema';
import { QuizSession, QuizSessionSchema } from './schemas/quiz-session.schema';
import { QuizAnswer, QuizAnswerSchema } from './schemas/quiz-answer.schema';
import { QuizResult, QuizResultSchema } from './schemas/quiz-result.schema';
import { Match, MatchSchema } from '../matching/schemas/match.schema';
import {
  Conversation,
  ConversationSchema,
} from '../chat/schemas/conversation.schema';
import { Message, MessageSchema } from '../chat/schemas/message.schema';
import { ChatService } from '../chat/chat.service';
import {
  MessageReaction,
  MessageReactionSchema,
} from '../chat/schemas/message-reaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizQuestion.name, schema: QuizQuestionSchema },
      { name: QuizSession.name, schema: QuizSessionSchema },
      { name: QuizAnswer.name, schema: QuizAnswerSchema },
      { name: QuizResult.name, schema: QuizResultSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: MessageReaction.name, schema: MessageReactionSchema },
    ]),
  ],
  controllers: [QuizController, QuizAdminController],
  providers: [QuizService, QuizAdminService, ChatService],
  exports: [QuizService],
})
export class QuizModule {}
