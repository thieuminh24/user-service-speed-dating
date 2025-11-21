// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private cloudinaryService: CloudinaryService,
  ) {}

  // ===== GET CONVERSATIONS =====

  @Get('conversations')
  async getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') conversationId: string, @Req() req: any) {
    return this.chatService.getConversationById(
      conversationId,
      req.user.userId,
    );
  }

  // ===== CREATE CONVERSATION FROM MATCH =====

  @Post('conversations/from-match/:matchId')
  async createConversation(@Param('matchId') matchId: string) {
    return this.chatService.getOrCreateConversation(matchId);
  }

  // ===== MESSAGES =====

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Req() req: any,
  ) {
    return this.chatService.getMessages(
      conversationId,
      req.user.userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Post('messages')
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    return this.chatService.sendMessage(req.user.userId, dto);
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') messageId: string, @Req() req: any) {
    await this.chatService.deleteMessage(messageId, req.user.userId);
    return { message: 'Message deleted' };
  }

  // ===== UPLOAD IMAGE/FILE =====

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    // Dùng uploadFile() cho chat files (không transform)
    const result = await this.cloudinaryService.uploadFile(file);
    return {
      fileUrl: result.secure_url,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }

  // ===== MARK AS READ =====

  @Post('conversations/:id/read')
  async markAsRead(@Param('id') conversationId: string, @Req() req: any) {
    await this.chatService.markAsRead(conversationId, req.user.userId);
    return { message: 'Marked as read' };
  }

  // ===== REACTIONS =====

  @Post('messages/:id/react')
  async reactToMessage(
    @Param('id') messageId: string,
    @Body() body: { emoji: string },
    @Req() req: any,
  ) {
    await this.chatService.reactToMessage(
      messageId,
      req.user.userId,
      body.emoji,
    );
    return { message: 'Reaction added' };
  }

  // ===== UNMATCH =====

  @Post('conversations/:id/unmatch')
  async unmatch(@Param('id') conversationId: string, @Req() req: any) {
    await this.chatService.unmatch(conversationId, req.user.userId);
    return { message: 'Unmatched successfully' };
  }

  // ===== BLOCK/UNBLOCK =====

  @Post('conversations/:id/block')
  async blockUser(@Param('id') conversationId: string, @Req() req: any) {
    await this.chatService.blockUser(conversationId, req.user.userId);
    return { message: 'User blocked' };
  }

  @Post('conversations/:id/unblock')
  async unblockUser(@Param('id') conversationId: string, @Req() req: any) {
    await this.chatService.unblockUser(conversationId, req.user.userId);
    return { message: 'User unblocked' };
  }
}
