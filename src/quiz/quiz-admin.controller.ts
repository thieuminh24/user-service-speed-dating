// src/quiz/quiz-admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { QuizAdminService } from './quiz-admin.service';
import { QuizCategory } from './schemas/quiz-question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller('admin/quiz')
// @UseGuards(AdminAuthGuard) // ← Implement admin guard later
export class QuizAdminController {
  constructor(private quizAdminService: QuizAdminService) {}

  // ===== CREATE QUESTION =====
  @Post('questions')
  async createQuestion(@Body() dto: CreateQuestionDto) {
    const question = await this.quizAdminService.createQuestion(dto);
    return {
      message: 'Question created successfully',
      question,
    };
  }

  // ===== GET ALL QUESTIONS =====
  @Get('questions')
  async getAllQuestions(@Query('category') category?: QuizCategory) {
    return this.quizAdminService.getAllQuestions(category);
  }

  // ===== GET QUESTION BY ID =====
  @Get('questions/:id')
  async getQuestion(@Param('id') id: string) {
    return this.quizAdminService.getQuestionById(id);
  }

  // ===== UPDATE QUESTION =====
  @Put('questions/:id')
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    const question = await this.quizAdminService.updateQuestion(id, dto);
    return {
      message: 'Question updated successfully',
      question,
    };
  }

  // ===== DELETE QUESTION =====
  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    await this.quizAdminService.deleteQuestion(id);
    return {
      message: 'Question deleted successfully',
    };
  }

  // ===== TOGGLE ACTIVE STATUS =====
  @Put('questions/:id/toggle')
  async toggleQuestionStatus(@Param('id') id: string) {
    const question = await this.quizAdminService.toggleQuestionStatus(id);
    return {
      message: `Question ${question.isActive ? 'activated' : 'deactivated'}`,
      question,
    };
  }

  // ===== GET STATISTICS =====
  @Get('statistics')
  async getStatistics() {
    return this.quizAdminService.getStatistics();
  }

  // ===== BULK CREATE (for seeding) =====
  @Post('questions/bulk')
  async bulkCreateQuestions(@Body() body: { questions: CreateQuestionDto[] }) {
    const questions = await this.quizAdminService.bulkCreateQuestions(
      body.questions,
    );
    return {
      message: `${questions.length} questions created successfully`,
      count: questions.length,
    };
  }
}
