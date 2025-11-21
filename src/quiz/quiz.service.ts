// src/quiz/quiz.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuizQuestion, QuizCategory } from './schemas/quiz-question.schema';
import { QuizSession, QuizSessionStatus } from './schemas/quiz-session.schema';
import { QuizAnswer } from './schemas/quiz-answer.schema';
import { QuizResult } from './schemas/quiz-result.schema';
import { Match } from '../matching/schemas/match.schema';
import { SubmitQuizAnswersDto } from './dto/submit-quiz-answers.dto';

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(QuizQuestion.name)
    private questionModel: Model<QuizQuestion>,
    @InjectModel(QuizSession.name) private sessionModel: Model<QuizSession>,
    @InjectModel(QuizAnswer.name) private answerModel: Model<QuizAnswer>,
    @InjectModel(QuizResult.name) private resultModel: Model<QuizResult>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
  ) {}

  // ===== CREATE QUIZ SESSION =====
  async createQuizSession(
    matchId: string,
    initiatorId: string,
  ): Promise<{ session: QuizSession; messageId?: string }> {
    // Verify match exists and user is part of it
    const match = await this.matchModel.findById(matchId);
    if (!match) throw new NotFoundException('Match not found');

    const isParticipant =
      match.user1.toString() === initiatorId ||
      match.user2.toString() === initiatorId;
    if (!isParticipant)
      throw new ForbiddenException('You are not part of this match');

    // Check if there's already an active session
    const existingSession = await this.sessionModel.findOne({
      matchId,
      status: {
        $in: [QuizSessionStatus.PENDING, QuizSessionStatus.IN_PROGRESS],
      },
    });

    if (existingSession) {
      throw new BadRequestException(
        'Quiz session already exists for this match',
      );
    }

    // Get participant (the other user in match)
    const participantId =
      match.user1.toString() === initiatorId
        ? match.user2.toString()
        : match.user1.toString();

    // Select 10 random questions (balanced by category)
    const questions = await this.getRandomQuestions();

    // Create session with 24h expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await this.sessionModel.create({
      matchId,
      initiator: initiatorId,
      participant: participantId,
      questions: questions.map((q) => q._id),
      status: QuizSessionStatus.PENDING,
      expiresAt,
    });

    // Increment usage count for selected questions
    await this.questionModel.updateMany(
      { _id: { $in: questions.map((q) => q._id) } },
      { $inc: { usageCount: 1 } },
    );

    return { session };
  }

  // ===== GET RANDOM QUESTIONS =====
  private async getRandomQuestions(): Promise<QuizQuestion[]> {
    const categories = Object.values(QuizCategory);
    const questionsPerCategory = Math.floor(10 / categories.length); // 2-3 per category
    const questions: QuizQuestion[] = [];

    // Get questions from each category
    for (const category of categories) {
      const categoryQuestions = await this.questionModel.aggregate([
        { $match: { category, isActive: true } },
        { $sample: { size: questionsPerCategory } },
      ]);

      questions.push(...categoryQuestions);
    }

    // Fill remaining slots if needed
    const remaining = 10 - questions.length;
    if (remaining > 0) {
      const extraQuestions = await this.questionModel.aggregate([
        {
          $match: {
            isActive: true,
            _id: { $nin: questions.map((q) => q._id) },
          },
        },
        { $sample: { size: remaining } },
      ]);
      questions.push(...extraQuestions);
    }

    if (questions.length < 10) {
      throw new BadRequestException('Not enough active questions in database');
    }

    return questions.slice(0, 10);
  }

  // ===== ACCEPT QUIZ =====
  async acceptQuiz(sessionId: string, userId: string): Promise<QuizSession> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Quiz session not found');

    if (session.participant.toString() !== userId) {
      throw new ForbiddenException('You are not the participant of this quiz');
    }

    if (session.status !== QuizSessionStatus.PENDING) {
      throw new BadRequestException('Quiz session is not pending');
    }

    session.status = QuizSessionStatus.IN_PROGRESS;
    session.startedAt = new Date();
    await session.save();

    return session;
  }

  // ===== GET QUIZ SESSION WITH QUESTIONS =====
  async getQuizSession(sessionId: string, userId: string): Promise<any> {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('questions')
      .populate('initiator', 'name photos')
      .populate('participant', 'name photos')
      .lean();

    if (!session) throw new NotFoundException('Quiz session not found');

    // Verify user is part of this quiz
    const isParticipant =
      session.initiator._id.toString() === userId ||
      session.participant._id.toString() === userId;

    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this quiz');
    }

    // Check if user already submitted
    const hasSubmitted = session.submittedBy.some(
      (id) => id.toString() === userId,
    );

    return {
      ...session,
      hasSubmitted,
      canSubmit:
        session.status === QuizSessionStatus.IN_PROGRESS && !hasSubmitted,
    };
  }

  // ===== SUBMIT ANSWERS =====
  async submitAnswers(userId: string, dto: SubmitQuizAnswersDto): Promise<any> {
    const session = await this.sessionModel.findById(dto.sessionId);
    if (!session) throw new NotFoundException('Quiz session not found');

    // Verify user is part of quiz
    const isParticipant =
      session.initiator.toString() === userId ||
      session.participant.toString() === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this quiz');
    }

    // Check status
    if (session.status !== QuizSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Quiz is not in progress');
    }

    // Check if already submitted
    const alreadySubmitted = session.submittedBy.some(
      (id) => id.toString() === userId,
    );
    if (alreadySubmitted) {
      throw new BadRequestException('You have already submitted answers');
    }

    // Validate all questions are from this session
    const sessionQuestionIds = session.questions.map((q) => q.toString());
    const submittedQuestionIds = dto.answers.map((a) => a.questionId);
    const allValid = submittedQuestionIds.every((id) =>
      sessionQuestionIds.includes(id),
    );

    if (!allValid) {
      throw new BadRequestException('Invalid questions in submission');
    }

    // Save answers
    const answer = await this.answerModel.create({
      sessionId: dto.sessionId,
      userId,
      answers: dto.answers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
      })),
      submittedAt: new Date(),
    });

    // Update session
    session.submittedBy.push(new Types.ObjectId(userId));
    await session.save();

    // Check if both users submitted → calculate result
    if (session.submittedBy.length === 2) {
      await this.calculateResult(session);
      session.status = QuizSessionStatus.COMPLETED;
      session.completedAt = new Date();
      await session.save();

      return {
        message: 'Quiz completed! Results are ready.',
        sessionId: session._id,
        status: 'completed',
      };
    }

    return {
      message: 'Answers submitted. Waiting for your match to complete.',
      sessionId: session._id,
      status: 'waiting',
    };
  }

  // ===== CALCULATE COMPATIBILITY SCORE =====
  private async calculateResult(session: QuizSession): Promise<QuizResult> {
    // Get both users' answers
    const answers = await this.answerModel
      .find({ sessionId: session._id })
      .populate('answers.questionId')
      .lean();

    if (answers.length !== 2) {
      throw new BadRequestException('Both users must submit answers');
    }

    const [answer1, answer2] = answers;

    // Compare answers
    let matchedAnswers = 0;
    const categoryMatches: Record<QuizCategory, number> = {
      [QuizCategory.PERSONALITY]: 0,
      [QuizCategory.LIFESTYLE]: 0,
      [QuizCategory.VALUES]: 0,
      [QuizCategory.ENTERTAINMENT]: 0,
    };

    // Fix TypeScript type inference
    const detailedComparison: Array<{
      questionId: Types.ObjectId;
      user1Answer: string;
      user2Answer: string;
      matched: boolean;
    }> = [];

    for (const ans1 of answer1.answers) {
      const ans2 = answer2.answers.find(
        (a: any) =>
          a.questionId._id.toString() === ans1.questionId._id.toString(),
      );

      if (!ans2) continue;

      const matched = ans1.selectedOption === ans2.selectedOption;
      if (matched) {
        matchedAnswers++;
        const category = (ans1.questionId as any).category;
        categoryMatches[category]++;
      }

      detailedComparison.push({
        questionId: ans1.questionId._id,
        user1Answer: ans1.selectedOption,
        user2Answer: ans2.selectedOption,
        matched,
      });
    }

    // Calculate compatibility score (0-100%)
    const compatibilityScore = Math.round((matchedAnswers / 10) * 100);

    // Create result
    const result = await this.resultModel.create({
      sessionId: session._id,
      matchId: session.matchId,
      user1: session.initiator,
      user2: session.participant,
      compatibilityScore,
      totalQuestions: 10,
      matchedAnswers,
      categoryScores: {
        personality: categoryMatches[QuizCategory.PERSONALITY] || 0,
        lifestyle: categoryMatches[QuizCategory.LIFESTYLE] || 0,
        values: categoryMatches[QuizCategory.VALUES] || 0,
        entertainment: categoryMatches[QuizCategory.ENTERTAINMENT] || 0,
      },
      detailedComparison,
    });

    return result;
  }

  // ===== GET QUIZ RESULT =====
  async getQuizResult(sessionId: string, userId: string): Promise<any> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Quiz session not found');

    // Verify user is part of quiz
    const isParticipant =
      session.initiator.toString() === userId ||
      session.participant.toString() === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this quiz');
    }

    if (session.status !== QuizSessionStatus.COMPLETED) {
      throw new BadRequestException('Quiz is not completed yet');
    }

    const result = await this.resultModel
      .findOne({ sessionId })
      .populate('user1', 'name photos')
      .populate('user2', 'name photos')
      .populate('detailedComparison.questionId', 'question category')
      .lean();

    if (!result) throw new NotFoundException('Result not found');

    return result;
  }

  // ===== GET USER'S QUIZ HISTORY =====
  async getUserQuizHistory(userId: string): Promise<any[]> {
    const results = await this.resultModel
      .find({
        $or: [{ user1: userId }, { user2: userId }],
      })
      .populate('user1', 'name photos')
      .populate('user2', 'name photos')
      .sort({ createdAt: -1 })
      .lean();

    return results.map((result: any) => {
      const partner =
        result.user1._id.toString() === userId ? result.user2 : result.user1;

      return {
        _id: result._id,
        sessionId: result.sessionId,
        matchId: result.matchId,
        partner: {
          _id: partner._id,
          name: partner.name,
          photos: partner.photos,
        },
        compatibilityScore: result.compatibilityScore,
        matchedAnswers: result.matchedAnswers,
        totalQuestions: result.totalQuestions,
        categoryScores: result.categoryScores,
        calculatedAt: result.calculatedAt,
      };
    });
  }
}
