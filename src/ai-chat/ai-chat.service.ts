// src/ai-chat/ai-chat.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiChat } from './schemas/ai-chat.schema';
import { User } from '../users/schemas/user.schema';
import {
  ChatHistoryDto,
  ChatResponseDto,
  SendMessageDto,
} from './dto/send-message.dto';
import { GeminiService } from './gemini.service';

@Injectable()
export class AiChatService {
  private readonly MAX_HISTORY_MESSAGES = 20; // Lưu 20 tin nhắn gần nhất

  constructor(
    @InjectModel(AiChat.name) private aiChatModel: Model<AiChat>,
    @InjectModel(User.name) private userModel: Model<User>,
    private geminiService: GeminiService,
  ) {}

  /**
   * Gửi tin nhắn và nhận phản hồi từ AI
   */
  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponseDto> {
    // 1. Lấy hoặc tạo conversation
    let conversation = await this.aiChatModel.findOne({ userId });

    if (!conversation) {
      // Lấy thông tin user để làm context
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      conversation = await this.aiChatModel.create({
        userId,
        messages: [],
        userContext: this.extractUserContext(user),
      });
    }

    // 2. Thêm tin nhắn user vào lịch sử
    conversation.messages.push({
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    });

    // 3. Lấy N tin nhắn gần nhất làm context
    const recentMessages = conversation.messages.slice(
      -this.MAX_HISTORY_MESSAGES,
    );

    // 4. Gọi Gemini API
    const aiResponse = await this.geminiService.generateResponse(
      dto.message,
      recentMessages.slice(0, -1), // Không bao gồm tin nhắn mới (đã gửi trong generateResponse)
      conversation.userContext,
    );

    // 5. Lưu phản hồi AI
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });

    conversation.lastMessageAt = new Date();

    // 6. Giới hạn số tin nhắn lưu trữ (giữ N tin gần nhất)
    if (conversation.messages.length > this.MAX_HISTORY_MESSAGES * 2) {
      conversation.messages = conversation.messages.slice(
        -this.MAX_HISTORY_MESSAGES * 2,
      );
    }

    await conversation.save();

    return new ChatResponseDto(aiResponse);
  }

  /**
   * Lấy lịch sử chat
   */
  async getChatHistory(userId: string): Promise<ChatHistoryDto> {
    const conversation = await this.aiChatModel.findOne({ userId });

    if (!conversation) {
      return {
        messages: [],
        totalMessages: 0,
      };
    }

    return {
      messages: conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
      totalMessages: conversation.messages.length,
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  /**
   * Xóa lịch sử chat
   */
  async clearChatHistory(userId: string): Promise<{ message: string }> {
    const result = await this.aiChatModel.findOneAndUpdate(
      { userId },
      { messages: [], lastMessageAt: new Date() },
      { new: true },
    );

    if (!result) {
      throw new NotFoundException('No chat history found');
    }

    return { message: 'Chat history cleared successfully' };
  }

  /**
   * Trích xuất context từ user profile
   */
  private extractUserContext(user: User): any {
    const age = user.dateOfBirth
      ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
      : undefined;

    return {
      name: user.name,
      age,
      gender: user.basic?.gender,
      lookingFor: user.basic?.lookingFor,
      aboutMe: user.aboutMe,
    };
  }

  /**
   * Cập nhật context user khi profile thay đổi
   */
  async updateUserContext(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    await this.aiChatModel.findOneAndUpdate(
      { userId },
      { userContext: this.extractUserContext(user) },
    );
  }
}
