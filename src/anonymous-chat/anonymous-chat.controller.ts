// src/anonymous-chat/anonymous-chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnonymousChatService } from './services/anonymous-chat.service';
import { GetAnonymousMessagesDto } from './dto/start-matching.dto';

@Controller('anonymous-chat')
@UseGuards(JwtAuthGuard)
export class AnonymousChatController {
  constructor(private readonly anonymousChatService: AnonymousChatService) {}

  /**
   * Get current room info
   * GET /anonymous-chat/current-room
   */
  @Get('current-room')
  async getCurrentRoom(@Req() req: any) {
    const room = await this.anonymousChatService.getCurrentRoom(
      req.user.userId,
    );

    if (!room) {
      return {
        hasActiveRoom: false,
        room: null,
      };
    }

    return {
      hasActiveRoom: true,
      room,
    };
  }

  /**
   * Get messages for a room
   * GET /anonymous-chat/messages?roomId=xxx&page=1&limit=50
   */
  @Get('messages')
  async getMessages(@Query() query: GetAnonymousMessagesDto, @Req() req: any) {
    return this.anonymousChatService.getMessages(
      req.user.userId,
      query.roomId,
      query.page || 1,
      query.limit || 50,
    );
  }

  /**
   * Leave current room
   * DELETE /anonymous-chat/leave/:roomId
   */
  @Delete('leave/:roomId')
  async leaveRoom(@Param('roomId') roomId: string, @Req() req: any) {
    return this.anonymousChatService.leaveRoom(req.user.userId, roomId);
  }

  /**
   * Get queue statistics (for admin/debugging)
   * GET /anonymous-chat/stats
   */
  @Get('stats')
  async getStats() {
    return this.anonymousChatService.getQueueStats();
  }

  /**
   * Clear queue and reset (admin/debug)
   * DELETE /anonymous-chat/admin/reset
   */
  @Delete('admin/reset')
  async resetQueue() {
    const redis = this.anonymousChatService['matchmakingQueue']['redis'];

    // Delete all anonymous chat keys
    const keys = await redis.keys('anonymous_chat:*');
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => redis.del(key)));
    }

    return {
      success: true,
      message: `Cleared ${keys.length} keys`,
      keys,
    };
  }

  /**
   * Force leave current room (for stuck users)
   * POST /anonymous-chat/force-leave
   */
  @Post('force-leave')
  async forceLeave(@Req() req: any) {
    const userId = req.user.userId;
    const redis = this.anonymousChatService['matchmakingQueue']['redis'];

    // Remove user-room mapping
    await redis.del(`anonymous_chat:user_room:${userId}`);

    return {
      success: true,
      message: 'Force left room',
    };
  }
}
