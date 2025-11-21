// src/quiz/quiz-admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuizQuestion, QuizCategory } from './schemas/quiz-question.schema';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateQuestionDto } from './dto/create-question.dto';

@Injectable()
export class QuizAdminService {
  constructor(
    @InjectModel(QuizQuestion.name) private questionModel: Model<QuizQuestion>,
  ) {}

  // ===== CREATE QUESTION =====
  async createQuestion(dto: CreateQuestionDto): Promise<QuizQuestion> {
    const question = await this.questionModel.create(dto);
    return question;
  }

  // ===== GET ALL QUESTIONS =====
  async getAllQuestions(category?: QuizCategory): Promise<QuizQuestion[]> {
    const filter: any = {};
    if (category) {
      filter.category = category;
    }

    return this.questionModel
      .find(filter)
      .sort({ category: 1, usageCount: -1 })
      .exec();
  }

  // ===== GET QUESTION BY ID =====
  async getQuestionById(id: string): Promise<QuizQuestion> {
    const question = await this.questionModel.findById(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  // ===== UPDATE QUESTION =====
  async updateQuestion(
    id: string,
    dto: UpdateQuestionDto,
  ): Promise<QuizQuestion> {
    const question = await this.questionModel.findByIdAndUpdate(id, dto, {
      new: true,
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  // ===== DELETE QUESTION =====
  async deleteQuestion(id: string): Promise<void> {
    const result = await this.questionModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Question not found');
    }
  }

  // ===== TOGGLE QUESTION ACTIVE STATUS =====
  async toggleQuestionStatus(id: string): Promise<QuizQuestion> {
    const question = await this.questionModel.findById(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    question.isActive = !question.isActive;
    await question.save();

    return question;
  }

  // ===== GET STATISTICS =====
  async getStatistics() {
    const total = await this.questionModel.countDocuments();
    const active = await this.questionModel.countDocuments({ isActive: true });
    const inactive = total - active;

    const byCategory = await this.questionModel.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]);

    return {
      total,
      active,
      inactive,
      byCategory,
    };
  }

  // ===== BULK CREATE QUESTIONS (for initial seed) =====
  async bulkCreateQuestions(
    questions: CreateQuestionDto[],
  ): Promise<QuizQuestion[]> {
    return this.questionModel.insertMany(questions);
  }
}
