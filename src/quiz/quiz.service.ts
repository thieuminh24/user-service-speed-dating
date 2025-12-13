// src/quiz/quiz.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
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
  private readonly logger = new Logger(QuizService.name);

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
    this.logger.log(
      `Creating quiz session for match ${matchId} by user ${initiatorId}`,
    );

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(matchId)) {
      this.logger.error(`Invalid matchId format: ${matchId}`);
      throw new BadRequestException('Invalid match ID format');
    }

    // Verify match exists and user is part of it
    const match = await this.matchModel.findById(matchId).lean();
    if (!match) {
      this.logger.error(`Match not found: ${matchId}`);
      throw new NotFoundException('Match not found');
    }

    const isParticipant =
      match.user1.toString() === initiatorId ||
      match.user2.toString() === initiatorId;

    if (!isParticipant) {
      this.logger.error(`User ${initiatorId} is not part of match ${matchId}`);
      throw new ForbiddenException('You are not part of this match');
    }

    // Check if there's already an active session
    const existingSession = await this.sessionModel.findOne({
      matchId: new Types.ObjectId(matchId),
      status: {
        $in: [QuizSessionStatus.PENDING, QuizSessionStatus.IN_PROGRESS],
      },
    });

    if (existingSession) {
      this.logger.warn(`Active session already exists: ${existingSession._id}`);
      throw new BadRequestException(
        'Quiz session already exists for this match',
      );
    }

    // Get participant (the other user in match)
    const participantId =
      match.user1.toString() === initiatorId
        ? match.user2.toString()
        : match.user1.toString();

    this.logger.log(`Participant identified: ${participantId}`);

    // Select 10 random questions (balanced by category)
    const questions = await this.getRandomQuestions();
    this.logger.log(`Selected ${questions.length} questions`);

    // Create session with 24h expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await this.sessionModel.create({
      matchId: new Types.ObjectId(matchId),
      initiator: new Types.ObjectId(initiatorId),
      participant: new Types.ObjectId(participantId),
      questions: questions.map((q) => q._id), // Already ObjectId from aggregate
      status: QuizSessionStatus.PENDING,
      expiresAt,
      submittedBy: [], // Initialize empty array
    });

    this.logger.log(`Quiz session created: ${session._id}`);

    // Increment usage count for selected questions
    await this.questionModel.updateMany(
      { _id: { $in: questions.map((q) => q._id) } },
      { $inc: { usageCount: 1 } },
    );

    return { session };
  }

  // ===== GET RANDOM QUESTIONS =====
  private async getRandomQuestions(): Promise<QuizQuestion[]> {
    this.logger.log('Getting random questions...');

    const categories = Object.values(QuizCategory);
    const questionsPerCategory = Math.floor(10 / categories.length);
    const questions: any[] = []; // Use any[] for aggregate results

    // Get questions from each category
    for (const category of categories) {
      const categoryQuestions = await this.questionModel.aggregate([
        { $match: { category, isActive: true } },
        { $sample: { size: questionsPerCategory } },
      ]);

      this.logger.log(
        `Category ${category}: ${categoryQuestions.length} questions`,
      );
      questions.push(...categoryQuestions);
    }

    // Fill remaining slots if needed
    const remaining = 10 - questions.length;
    if (remaining > 0) {
      this.logger.log(`Getting ${remaining} additional questions`);
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
      this.logger.error(`Only ${questions.length} questions available`);
      throw new BadRequestException('Not enough active questions in database');
    }

    return questions.slice(0, 10) as QuizQuestion[];
  }

  // ===== ACCEPT QUIZ =====
  async acceptQuiz(sessionId: string, userId: string): Promise<QuizSession> {
    this.logger.log(`User ${userId} accepting quiz ${sessionId}`);

    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }

    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      this.logger.error(`Quiz session not found: ${sessionId}`);
      throw new NotFoundException('Quiz session not found');
    }

    if (session.participant.toString() !== userId) {
      this.logger.error(
        `User ${userId} is not participant of session ${sessionId}`,
      );
      throw new ForbiddenException('You are not the participant of this quiz');
    }

    if (session.status !== QuizSessionStatus.PENDING) {
      this.logger.error(
        `Session ${sessionId} status is ${session.status}, not PENDING`,
      );
      throw new BadRequestException('Quiz session is not pending');
    }

    session.status = QuizSessionStatus.IN_PROGRESS;
    session.startedAt = new Date();
    await session.save();

    this.logger.log(`Quiz ${sessionId} started`);
    return session;
  }

  // ===== UPDATE: getQuizSession to auto-accept if pending =====
  async getQuizSession(sessionId: string, userId: string): Promise<any> {
    this.logger.log(`Getting quiz session ${sessionId} for user ${userId}`);

    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }

    const session = await this.sessionModel
      .findById(sessionId)
      .populate('questions')
      .populate('initiator', 'name photos')
      .populate('participant', 'name photos')
      .lean();

    if (!session) {
      this.logger.error(`Quiz session not found: ${sessionId}`);
      throw new NotFoundException('Quiz session not found');
    }

    // Verify user is part of this quiz
    const isParticipant =
      session.initiator._id.toString() === userId ||
      session.participant._id.toString() === userId;

    if (!isParticipant) {
      this.logger.error(`User ${userId} not part of quiz ${sessionId}`);
      throw new ForbiddenException('You are not part of this quiz');
    }

    // ===== AUTO-ACCEPT IF PENDING =====
    if (session.status === QuizSessionStatus.PENDING) {
      this.logger.log(`Auto-accepting quiz ${sessionId} for user ${userId}`);

      // Update to IN_PROGRESS
      await this.sessionModel.findByIdAndUpdate(sessionId, {
        status: QuizSessionStatus.IN_PROGRESS,
        startedAt: new Date(),
      });

      // Refetch with updated status
      const updatedSession = await this.sessionModel
        .findById(sessionId)
        .populate('questions')
        .populate('initiator', 'name photos')
        .populate('participant', 'name photos')
        .lean();

      session.status = QuizSessionStatus.IN_PROGRESS;
      session.startedAt = new Date();
    }

    // Check if user already submitted
    const hasSubmitted =
      session.submittedBy?.some((id) => id.toString() === userId) || false;

    this.logger.log(
      `Session ${sessionId}: status=${session.status}, hasSubmitted=${hasSubmitted}`,
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
    this.logger.log(
      `User ${userId} submitting answers for session ${dto.sessionId}`,
    );
    this.logger.debug(`Answers: ${JSON.stringify(dto.answers)}`);

    if (!Types.ObjectId.isValid(dto.sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }

    const session = await this.sessionModel.findById(dto.sessionId);
    if (!session) {
      this.logger.error(`Quiz session not found: ${dto.sessionId}`);
      throw new NotFoundException('Quiz session not found');
    }

    // Verify user is part of quiz
    const isParticipant =
      session.initiator.toString() === userId ||
      session.participant.toString() === userId;

    if (!isParticipant) {
      this.logger.error(`User ${userId} not part of quiz ${dto.sessionId}`);
      throw new ForbiddenException('You are not part of this quiz');
    }

    // Check status
    if (session.status !== QuizSessionStatus.IN_PROGRESS) {
      this.logger.error(`Session ${dto.sessionId} status is ${session.status}`);
      throw new BadRequestException(
        `Quiz is not in progress (status: ${session.status})`,
      );
    }

    // Check if already submitted
    const alreadySubmitted =
      session.submittedBy?.some((id) => id.toString() === userId) || false;

    if (alreadySubmitted) {
      this.logger.error(
        `User ${userId} already submitted for ${dto.sessionId}`,
      );
      throw new BadRequestException('You have already submitted answers');
    }

    // Validate answers
    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException('No answers provided');
    }

    if (dto.answers.length !== session.questions.length) {
      this.logger.error(
        `Expected ${session.questions.length} answers, got ${dto.answers.length}`,
      );
      throw new BadRequestException(
        `Expected ${session.questions.length} answers, got ${dto.answers.length}`,
      );
    }

    // Validate all questions are from this session
    const sessionQuestionIds = session.questions.map((q) => q.toString());
    const submittedQuestionIds = dto.answers.map((a) => a.questionId);
    const allValid = submittedQuestionIds.every((id) =>
      sessionQuestionIds.includes(id),
    );

    if (!allValid) {
      this.logger.error('Invalid questions in submission');
      throw new BadRequestException('Invalid questions in submission');
    }

    // Validate all answers have selectedOption
    const invalidAnswers = dto.answers.filter((a) => !a.selectedOption);
    if (invalidAnswers.length > 0) {
      this.logger.error(
        `Missing selectedOption for ${invalidAnswers.length} questions`,
      );
      throw new BadRequestException('All questions must have an answer');
    }

    // Save answers
    const answer = await this.answerModel.create({
      sessionId: new Types.ObjectId(dto.sessionId),
      userId: new Types.ObjectId(userId),
      answers: dto.answers.map((a) => ({
        questionId: new Types.ObjectId(a.questionId),
        selectedOption: a.selectedOption,
      })),
      submittedAt: new Date(),
    });

    this.logger.log(`Answers saved: ${answer._id}`);

    // Update session - Initialize submittedBy if undefined
    if (!session.submittedBy) {
      session.submittedBy = [];
    }
    session.submittedBy.push(new Types.ObjectId(userId));
    await session.save();

    this.logger.log(
      `Session updated. Submitted by: ${session.submittedBy.length} users`,
    );

    // Check if both users submitted → calculate result
    if (session.submittedBy.length === 2) {
      this.logger.log('Both users submitted. Calculating result...');

      try {
        await this.calculateResult(session);
        session.status = QuizSessionStatus.COMPLETED;
        session.completedAt = new Date();
        await session.save();

        this.logger.log(`Quiz ${dto.sessionId} completed!`);

        return {
          message: 'Quiz completed! Results are ready.',
          sessionId: session._id,
          status: 'completed',
        };
      } catch (error) {
        this.logger.error(`Failed to calculate result: ${error.message}`);
        throw error;
      }
    }

    return {
      message: 'Answers submitted. Waiting for your match to complete.',
      sessionId: session._id,
      status: 'waiting',
    };
  }

  // ===== CALCULATE COMPATIBILITY SCORE =====
  private async calculateResult(session: QuizSession): Promise<QuizResult> {
    this.logger.log(`Calculating result for session ${session._id}`);

    // Get both users' answers with populated questions
    const answers = await this.answerModel
      .find({ sessionId: session._id })
      .lean();

    if (answers.length !== 2) {
      this.logger.error(`Expected 2 answer sets, found ${answers.length}`);
      throw new BadRequestException('Both users must submit answers');
    }

    // Get all questions for proper comparison
    const questions = await this.questionModel
      .find({ _id: { $in: session.questions } })
      .lean();

    const [answer1, answer2] = answers;

    // Compare answers
    let matchedAnswers = 0;
    const categoryMatches: Record<QuizCategory, number> = {
      [QuizCategory.PERSONALITY]: 0,
      [QuizCategory.LIFESTYLE]: 0,
      [QuizCategory.VALUES]: 0,
      [QuizCategory.ENTERTAINMENT]: 0,
    };

    const detailedComparison: Array<{
      questionId: Types.ObjectId;
      user1Answer: string;
      user2Answer: string;
      matched: boolean;
    }> = [];

    for (const ans1 of answer1.answers) {
      const ans2 = answer2.answers.find(
        (a: any) => a.questionId.toString() === ans1.questionId.toString(),
      );

      if (!ans2) {
        this.logger.warn(
          `No matching answer found for question ${ans1.questionId}`,
        );
        continue;
      }

      const matched = ans1.selectedOption === ans2.selectedOption;
      if (matched) {
        matchedAnswers++;

        // Find question to get category
        const question = questions.find(
          (q) => q._id.toString() === ans1.questionId.toString(),
        );

        if (question) {
          categoryMatches[question.category]++;
        }
      }

      detailedComparison.push({
        questionId: new Types.ObjectId(ans1.questionId),
        user1Answer: ans1.selectedOption,
        user2Answer: ans2.selectedOption,
        matched,
      });
    }

    // Calculate compatibility score (0-100%)
    const compatibilityScore = Math.round((matchedAnswers / 10) * 100);

    this.logger.log(
      `Compatibility score: ${compatibilityScore}% (${matchedAnswers}/10 matched)`,
    );

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

    this.logger.log(`Result created: ${result._id}`);
    return result;
  }

  // ===== GET QUIZ RESULT =====
  async getQuizResult(sessionId: string, userId: string): Promise<any> {
    this.logger.log(
      `Getting result for session ${sessionId} by user ${userId}`,
    );

    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }

    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      this.logger.error(`Quiz session not found: ${sessionId}`);
      throw new NotFoundException('Quiz session not found');
    }

    // Verify user is part of quiz
    const isParticipant =
      session.initiator.toString() === userId ||
      session.participant.toString() === userId;

    if (!isParticipant) {
      this.logger.error(`User ${userId} not part of quiz ${sessionId}`);
      throw new ForbiddenException('You are not part of this quiz');
    }

    if (session.status !== QuizSessionStatus.COMPLETED) {
      this.logger.error(
        `Quiz ${sessionId} not completed (status: ${session.status})`,
      );
      throw new BadRequestException('Quiz is not completed yet');
    }

    const result = await this.resultModel
      .findOne({ sessionId: new Types.ObjectId(sessionId) })
      .populate('user1', 'name photos')
      .populate('user2', 'name photos')
      .populate('detailedComparison.questionId', 'question category')
      .lean();

    if (!result) {
      this.logger.error(`Result not found for session ${sessionId}`);
      throw new NotFoundException('Result not found');
    }

    this.logger.log(`Result found: ${result._id}`);
    return result;
  }

  // ===== GET USER'S QUIZ HISTORY =====
  async getUserQuizHistory(userId: string): Promise<any[]> {
    this.logger.log(`Getting quiz history for user ${userId}`);

    const results = await this.resultModel
      .find({
        $or: [
          { user1: new Types.ObjectId(userId) },
          { user2: new Types.ObjectId(userId) },
        ],
      })
      .populate('user1', 'name photos')
      .populate('user2', 'name photos')
      .sort({ createdAt: -1 })
      .lean();

    this.logger.log(`Found ${results.length} quiz results`);

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
