// src/quiz/quiz.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizService } from './quiz.service';
import { ChatService } from '../chat/chat.service';
import { CreateQuizSessionDto } from './dto/create-quiz-session.dto';
import { SubmitQuizAnswersDto } from './dto/submit-quiz-answers.dto';

@Controller('quiz')
@UseGuards(JwtAuthGuard)
export class QuizController {
  private readonly logger = new Logger(QuizController.name);

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
    try {
      this.logger.log(
        `Creating quiz session for match ${dto.matchId} by user ${req.user.userId}`,
      );
      this.logger.debug(`DTO: ${JSON.stringify(dto)}`);

      const result = await this.quizService.createQuizSession(
        dto.matchId,
        req.user.userId,
      );

      // If conversationId provided, send quiz invite message
      if (dto.conversationId && result?.session?._id) {
        this.logger.log(
          `Sending quiz invite to conversation ${dto.conversationId}`,
        );

        try {
          await this.chatService.sendQuizInvite(
            dto.conversationId,
            req.user.userId,
            result.session._id.toString(),
          );

          this.logger.log('Quiz invite sent successfully');
        } catch (chatError) {
          this.logger.error(`Failed to send chat invite: ${chatError.message}`);
          // Don't fail the whole request if chat fails
        }
      }

      return {
        message: dto.conversationId
          ? 'Quiz invitation sent via chat!'
          : 'Quiz session created!',
        sessionId: result.session._id,
        status: result.session.status,
      };
    } catch (error) {
      this.logger.error(`Failed to create quiz session: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  // ===== ACCEPT QUIZ INVITATION =====
  @Post('sessions/:sessionId/accept')
  async acceptQuiz(@Req() req: any, @Param('sessionId') sessionId: string) {
    try {
      this.logger.log(`User ${req.user.userId} accepting quiz ${sessionId}`);

      const session = await this.quizService.acceptQuiz(
        sessionId,
        req.user.userId,
      );

      return {
        message: "Quiz accepted. Let's start!",
        sessionId: session._id,
        status: session.status,
      };
    } catch (error) {
      this.logger.error(`Failed to accept quiz: ${error.message}`);
      throw error;
    }
  }

  // ===== GET QUIZ SESSION (with questions) =====
  @Get('sessions/:sessionId')
  async getSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    try {
      this.logger.log(
        `Getting quiz session ${sessionId} for user ${req.user.userId}`,
      );

      const session = await this.quizService.getQuizSession(
        sessionId,
        req.user.userId,
      );

      this.logger.log(
        `Session retrieved: status=${session.status}, questions=${session.questions?.length}`,
      );

      return session;
    } catch (error) {
      this.logger.error(`Failed to get quiz session: ${error.message}`);
      throw error;
    }
  }

  // ===== SUBMIT ANSWERS =====
  @Post('sessions/:sessionId/submit')
  async submitAnswers(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitQuizAnswersDto,
  ) {
    try {
      this.logger.log(
        `User ${req.user.userId} submitting answers for session ${sessionId}`,
      );
      this.logger.debug(`Request body: ${JSON.stringify(dto)}`);

      // Validate DTO
      if (!dto.answers || !Array.isArray(dto.answers)) {
        throw new HttpException(
          'Invalid request: answers must be an array',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (dto.answers.length === 0) {
        throw new HttpException(
          'Invalid request: at least one answer is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Override sessionId from URL to ensure consistency
      dto.sessionId = sessionId;

      const result = await this.quizService.submitAnswers(req.user.userId, dto);

      this.logger.log(`Answers submitted successfully: ${result.status}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to submit answers: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  // ===== GET QUIZ RESULT =====
  @Get('sessions/:sessionId/result')
  async getResult(@Req() req: any, @Param('sessionId') sessionId: string) {
    try {
      this.logger.log(
        `Getting result for session ${sessionId} by user ${req.user.userId}`,
      );

      const result = await this.quizService.getQuizResult(
        sessionId,
        req.user.userId,
      );

      this.logger.log(`Result retrieved: score=${result.compatibilityScore}%`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get quiz result: ${error.message}`);
      throw error;
    }
  }

  // ===== GET USER'S QUIZ HISTORY =====
  @Get('my-history')
  async getMyHistory(@Req() req: any) {
    try {
      this.logger.log(`Getting quiz history for user ${req.user.userId}`);

      const history = await this.quizService.getUserQuizHistory(
        req.user.userId,
      );

      this.logger.log(`Found ${history.length} quiz results`);
      return history;
    } catch (error) {
      this.logger.error(`Failed to get quiz history: ${error.message}`);
      throw error;
    }
  }
}
