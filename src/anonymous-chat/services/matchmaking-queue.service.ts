// src/anonymous-chat/services/matchmaking-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { QueuedUser, MatchResult } from '../interfaces/matchmaking.interface';
import { NameGeneratorService } from './name-generator.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MatchmakingQueueService {
  private readonly logger = new Logger(MatchmakingQueueService.name);
  private readonly QUEUE_KEY = 'anonymous_chat:queue';
  private readonly USER_ROOM_PREFIX = 'anonymous_chat:user_room:';
  private readonly ACTIVE_ROOM_PREFIX = 'anonymous_chat:active_room:';

  constructor(
    private readonly redis: RedisService,
    private readonly nameGenerator: NameGeneratorService,
  ) {}

  /**
   * Add user to matchmaking queue
   * Returns true if added, false if already in queue or has active room
   */
  async addToQueue(userId: string, socketId: string): Promise<boolean> {
    // Check if user already has an active room
    const existingRoom = await this.getUserActiveRoom(userId);
    if (existingRoom) {
      this.logger.warn(
        `User ${userId} already has active room: ${existingRoom}`,
      );
      return false;
    }

    // Check if already in queue (with error handling)
    try {
      const queueLength = await this.redis.getQueueLength(this.QUEUE_KEY);

      // If queue exists, check if user is in it
      if (queueLength > 0) {
        const items = await this.redis.redis.lrange(this.QUEUE_KEY, 0, -1);
        for (const item of items) {
          try {
            const parsed: QueuedUser = JSON.parse(item);
            if (parsed.userId === userId) {
              this.logger.warn(`User ${userId} already in queue`);
              return false;
            }
          } catch (parseError) {
            // Invalid item in queue, skip
            continue;
          }
        }
      }
    } catch (error) {
      // If WRONGTYPE error, delete the key and recreate as list
      if (error.message.includes('WRONGTYPE')) {
        this.logger.warn(`Queue has wrong type, recreating...`);
        await this.redis.del(this.QUEUE_KEY);
      } else {
        this.logger.error(`Error checking queue: ${error.message}`);
      }
    }

    // Add to queue with metadata
    const queuedUser: QueuedUser = {
      userId,
      socketId,
      queuedAt: Date.now(),
    };

    await this.redis.pushToQueue(this.QUEUE_KEY, JSON.stringify(queuedUser));
    this.logger.log(
      `User ${userId} added to queue. Queue length: ${await this.getQueueLength()}`,
    );

    return true;
  }

  /**
   * Remove user from queue
   */
  async removeFromQueue(userId: string): Promise<boolean> {
    const items = await this.redis.smembers(this.QUEUE_KEY);

    for (const item of items) {
      try {
        const parsed: QueuedUser = JSON.parse(item);
        if (parsed.userId === userId) {
          await this.redis.removeFromQueue(this.QUEUE_KEY, item);
          this.logger.log(`User ${userId} removed from queue`);
          return true;
        }
      } catch (error) {
        this.logger.error(`Error parsing queue item: ${error.message}`);
      }
    }

    return false;
  }

  /**
   * Attempt to match two users from queue
   * Uses FIFO strategy
   */
  async attemptMatch(): Promise<MatchResult | null> {
    const queueLength = await this.getQueueLength();

    if (queueLength < 2) {
      return null; // Not enough users
    }

    // Pop first two users (FIFO)
    const user1Raw = await this.redis.popFromQueue(this.QUEUE_KEY);
    const user2Raw = await this.redis.popFromQueue(this.QUEUE_KEY);

    if (!user1Raw || !user2Raw) {
      // If only one was popped, add it back
      if (user1Raw) await this.redis.pushToQueue(this.QUEUE_KEY, user1Raw);
      return null;
    }

    try {
      const user1: QueuedUser = JSON.parse(user1Raw);
      const user2: QueuedUser = JSON.parse(user2Raw);

      // Generate room ID and anonymous names
      const roomId = `anon_room_${uuidv4()}`;
      const [name1, name2] = this.nameGenerator.generateNamePair();

      // Store user-room mapping (for quick lookup)
      await Promise.all([
        this.redis.set(`${this.USER_ROOM_PREFIX}${user1.userId}`, roomId, 3600), // 1 hour TTL
        this.redis.set(`${this.USER_ROOM_PREFIX}${user2.userId}`, roomId, 3600),
        this.redis.set(
          `${this.ACTIVE_ROOM_PREFIX}${roomId}`,
          JSON.stringify({
            user1: user1.userId,
            user2: user2.userId,
            createdAt: Date.now(),
          }),
          3600,
        ),
      ]);

      const matchResult: MatchResult = {
        roomId,
        user1: {
          userId: user1.userId,
          socketId: user1.socketId,
          anonymousName: name1,
        },
        user2: {
          userId: user2.userId,
          socketId: user2.socketId,
          anonymousName: name2,
        },
      };

      this.logger.log(`Match created: ${roomId} - ${name1} & ${name2}`);
      return matchResult;
    } catch (error) {
      this.logger.error(`Error creating match: ${error.message}`);
      // Add users back to queue on error
      if (user1Raw) await this.redis.pushToQueue(this.QUEUE_KEY, user1Raw);
      if (user2Raw) await this.redis.pushToQueue(this.QUEUE_KEY, user2Raw);
      return null;
    }
  }

  /**
   * Get user's active room ID
   */
  async getUserActiveRoom(userId: string): Promise<string | null> {
    const roomId = await this.redis.get(`${this.USER_ROOM_PREFIX}${userId}`);

    if (!roomId) return null;

    // Verify room still exists in active rooms
    const roomExists = await this.redis.exists(
      `${this.ACTIVE_ROOM_PREFIX}${roomId}`,
    );

    if (!roomExists) {
      // Room doesn't exist anymore, clean up mapping
      await this.redis.del(`${this.USER_ROOM_PREFIX}${userId}`);
      this.logger.warn(`Cleaned up stale room mapping for user ${userId}`);
      return null;
    }

    return roomId;
  }

  /**
   * Remove user's active room mapping
   */
  async removeUserRoom(userId: string): Promise<void> {
    await this.redis.del(`${this.USER_ROOM_PREFIX}${userId}`);
  }

  /**
   * Remove active room data
   */
  async removeActiveRoom(roomId: string): Promise<void> {
    const roomData = await this.redis.get(
      `${this.ACTIVE_ROOM_PREFIX}${roomId}`,
    );
    if (roomData) {
      const { user1, user2 } = JSON.parse(roomData);
      await Promise.all([
        this.redis.del(`${this.USER_ROOM_PREFIX}${user1}`),
        this.redis.del(`${this.USER_ROOM_PREFIX}${user2}`),
        this.redis.del(`${this.ACTIVE_ROOM_PREFIX}${roomId}`),
      ]);
    }
  }

  /**
   * Get current queue length
   */
  async getQueueLength(): Promise<number> {
    return this.redis.getQueueLength(this.QUEUE_KEY);
  }

  /**
   * Check if user is in queue
   */
  async isUserInQueue(userId: string): Promise<boolean> {
    try {
      const queueLength = await this.redis.getQueueLength(this.QUEUE_KEY);
      if (queueLength === 0) return false;

      const items = await this.redis.smembers(this.QUEUE_KEY);
      if (!items || items.length === 0) {
        // Try list if smembers fails
        const listItems = await this.redis.redis.lrange(this.QUEUE_KEY, 0, -1);
        for (const item of listItems) {
          try {
            const parsed: QueuedUser = JSON.parse(item);
            if (parsed.userId === userId) return true;
          } catch {
            continue;
          }
        }
        return false;
      }

      for (const item of items) {
        try {
          const parsed: QueuedUser = JSON.parse(item);
          if (parsed.userId === userId) return true;
        } catch {
          continue;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Error checking queue: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear entire queue (admin/debug use)
   */
  async clearQueue(): Promise<void> {
    await this.redis.del(this.QUEUE_KEY);
    this.logger.log('Queue cleared');
  }
}
