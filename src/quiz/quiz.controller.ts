// src/quiz/quiz.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizService } from './quiz.service';
import { ChatService } from '../chat/chat.service';
import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import { SubmitQuizAnswersDto } from './dto/submit-quiz-answers.dto';

@Controller('quiz')
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(
    private quizService: QuizService,
    private chatService: ChatService,
  ) {}

  // ===== CREATE QUIZ SESSION & SEND INVITE =====
  @Post('sessions')
  async createSession(
    @Req() req: any,
    @Body() dto: CreateQuizSessionDto & { conversationId?: string },
  ) {
    const result = await this.quizService.createQuizSession(
      dto.matchId,
      req.user.userId,
    );

    // If conversationId provided, send quiz invite message
    if (dto.conversationId && result?.session?._id) {
      await this.chatService.sendQuizInvite(
        dto.conversationId,
        req.user.userId,
        result.session._id.toString(),
      );
    }

    return {
      message: 'Quiz invitation sent via chat!',
      sessionId: result.session._id,
      status: result.session.status,
    };
  }

  // ===== ACCEPT QUIZ INVITATION =====
  @Post('sessions/:sessionId/accept')
  async acceptQuiz(@Req() req: any, @Param('sessionId') sessionId: string) {
    const session = await this.quizService.acceptQuiz(
      sessionId,
      req.user.userId,
    );

    return {
      message: "Quiz accepted. Let's start!",
      sessionId: session._id,
      status: session.status,
    };
  }

  // ===== GET QUIZ SESSION (with questions) =====
  @Get('sessions/:sessionId')
  async getSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.quizService.getQuizSession(sessionId, req.user.userId);
  }

  // ===== SUBMIT ANSWERS =====
  @Post('sessions/:sessionId/submit')
  async submitAnswers(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitQuizAnswersDto,
  ) {
    // Override sessionId from URL
    dto.sessionId = sessionId;
    return this.quizService.submitAnswers(req.user.userId, dto);
  }

  // ===== GET QUIZ RESULT =====
  @Get('sessions/:sessionId/result')
  async getResult(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.quizService.getQuizResult(sessionId, req.user.userId);
  }

  // ===== GET USER'S QUIZ HISTORY =====
  @Get('my-history')
  async getMyHistory(@Req() req: any) {
    return this.quizService.getUserQuizHistory(req.user.userId);
  }
}
