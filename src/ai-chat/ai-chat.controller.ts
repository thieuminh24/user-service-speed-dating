// src/ai-chat/ai-chat.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import {
  ChatHistoryDto,
  ChatResponseDto,
  SendMessageDto,
} from './dto/send-message.dto';

@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * POST /ai-chat/send
   * Gửi tin nhắn đến AI advisor
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Request() req,
    @Body() dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    return this.aiChatService.sendMessage(req.user.userId, dto);
  }

  /**
   * GET /ai-chat/history
   * Lấy lịch sử chat
   */
  @Get('history')
  async getChatHistory(@Request() req): Promise<ChatHistoryDto> {
    return this.aiChatService.getChatHistory(req.user.userId);
  }

  /**
   * DELETE /ai-chat/history
   * Xóa lịch sử chat
   */
  @Delete('history')
  async clearChatHistory(@Request() req): Promise<{ message: string }> {
    return this.aiChatService.clearChatHistory(req.user.userId);
  }
}
