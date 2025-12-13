// src/anonymous-chat/services/anonymous-chat.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MatchmakingQueueService } from './matchmaking-queue.service';
import { AnonymousRoomService } from './anonymous-room.service';
import { TimeoutManagerService } from './timeout-manager.service';
import { MatchResult } from '../interfaces/matchmaking.interface';

@Injectable()
export class AnonymousChatService {
  private readonly logger = new Logger(AnonymousChatService.name);

  constructor(
    private readonly matchmakingQueue: MatchmakingQueueService,
    private readonly roomService: AnonymousRoomService,
    private readonly timeoutManager: TimeoutManagerService,
  ) {}

  /**
   * Start matchmaking for a user
   */
  async startMatching(
    userId: string,
    socketId: string,
  ): Promise<{
    success: boolean;
    message: string;
    queuePosition?: number;
  }> {
    // Check if user already has active room
    const activeRoom = await this.roomService.getUserActiveRoom(userId);
    if (activeRoom) {
      throw new BadRequestException(
        'You already have an active chat. Please leave it first.',
      );
    }

    // Check if already in queue
    const isInQueue = await this.matchmakingQueue.isUserInQueue(userId);
    if (isInQueue) {
      const queueLength = await this.matchmakingQueue.getQueueLength();
      return {
        success: true,
        message: 'Already in queue',
        queuePosition: queueLength,
      };
    }

    // Add to queue
    const added = await this.matchmakingQueue.addToQueue(userId, socketId);

    if (!added) {
      throw new BadRequestException('Failed to join queue');
    }

    const queueLength = await this.matchmakingQueue.getQueueLength();

    this.logger.log(`User ${userId} started matching. Queue: ${queueLength}`);

    return {
      success: true,
      message: 'Added to matchmaking queue',
      queuePosition: queueLength,
    };
  }

  /**
   * Cancel matchmaking for a user
   */
  async cancelMatching(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const removed = await this.matchmakingQueue.removeFromQueue(userId);

    if (removed) {
      this.logger.log(`User ${userId} cancelled matching`);
      return {
        success: true,
        message: 'Removed from queue',
      };
    }

    return {
      success: false,
      message: 'Not in queue',
    };
  }

  /**
   * Attempt to create a match
   * Called periodically or on new queue entries
   */
  async processMatchmaking(): Promise<MatchResult | null> {
    const matchResult = await this.matchmakingQueue.attemptMatch();

    if (matchResult) {
      // Create room in database
      await this.roomService.createRoom(
        matchResult.roomId,
        matchResult.user1.userId,
        matchResult.user2.userId,
        matchResult.user1.anonymousName,
        matchResult.user2.anonymousName,
      );

      this.logger.log(
        `Match processed: ${matchResult.user1.anonymousName} & ${matchResult.user2.anonymousName}`,
      );
    }

    return matchResult;
  }

  /**
   * Send message in anonymous room
   */
  async sendMessage(userId: string, roomId: string, content: string) {
    const message = await this.roomService.sendMessage(roomId, userId, content);
    return message;
  }

  /**
   * Get messages for a room
   */
  async getMessages(
    userId: string,
    roomId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    return this.roomService.getMessages(roomId, userId, page, limit);
  }

  /**
   * Leave room
   */
  async leaveRoom(
    userId: string,
    roomId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const room = await this.roomService.getRoomByRoomId(roomId);

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    if (room.status !== 'active') {
      return {
        success: false,
        message: 'Room already closed',
      };
    }

    // Close room
    await this.roomService.closeRoom(roomId, userId, 'user_left' as any);

    // Clear any disconnect timeouts
    this.timeoutManager.clearDisconnectTimeout(userId);

    this.logger.log(`User ${userId} left room ${roomId}`);

    return {
      success: true,
      message: 'Left room successfully',
    };
  }

  /**
   * Get user's current room info
   */
  async getCurrentRoom(userId: string) {
    const room = await this.roomService.getUserActiveRoom(userId);

    if (!room) {
      return null;
    }

    return {
      roomId: room.roomId,
      yourAnonymousName: this.roomService.getAnonymousNameForUser(room, userId),
      partnerAnonymousName: this.roomService.getPartnerAnonymousName(
        room,
        userId,
      ),
      status: room.status,
      messageCount: room.messageCount,
      createdAt: room.matchedAt,
    };
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(userId: string, roomId: string): void {
    this.timeoutManager.handleDisconnect(userId, roomId);
  }

  /**
   * Handle user reconnect
   */
  handleReconnect(userId: string): boolean {
    return this.timeoutManager.handleReconnect(userId);
  }

  /**
   * Get queue stats (for admin/debug)
   */
  async getQueueStats() {
    const queueLength = await this.matchmakingQueue.getQueueLength();
    const disconnectedUsers = this.timeoutManager.getDisconnectedUsers();

    return {
      queueLength,
      disconnectedUsers: Array.from(disconnectedUsers.entries()),
    };
  }
}
