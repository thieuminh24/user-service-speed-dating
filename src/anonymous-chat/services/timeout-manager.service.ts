// src/anonymous-chat/services/timeout-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnonymousRoomService } from './anonymous-room.service';

@Injectable()
export class TimeoutManagerService {
  private readonly logger = new Logger(TimeoutManagerService.name);

  // Track disconnected users (userId -> { roomId, disconnectedAt, timeoutId })
  private disconnectedUsers = new Map<
    string,
    {
      roomId: string;
      disconnectedAt: number;
      timeoutId: NodeJS.Timeout;
    }
  >();

  // Configurable timeouts
  private readonly DISCONNECT_TIMEOUT_SECONDS = 30; // 30 seconds
  private readonly IDLE_TIMEOUT_MINUTES = 5; // 5 minutes

  constructor(private readonly roomService: AnonymousRoomService) {}

  /**
   * Handle user disconnect - start countdown
   */
  handleDisconnect(userId: string, roomId: string): void {
    // Clear existing timeout if any
    this.clearDisconnectTimeout(userId);

    this.logger.log(
      `User ${userId} disconnected from room ${roomId}. Starting ${this.DISCONNECT_TIMEOUT_SECONDS}s timeout...`,
    );

    const timeoutId = setTimeout(async () => {
      await this.onDisconnectTimeout(userId, roomId);
    }, this.DISCONNECT_TIMEOUT_SECONDS * 1000);

    this.disconnectedUsers.set(userId, {
      roomId,
      disconnectedAt: Date.now(),
      timeoutId,
    });
  }

  /**
   * Handle user reconnect - cancel timeout
   */
  handleReconnect(userId: string): boolean {
    const disconnectInfo = this.disconnectedUsers.get(userId);

    if (disconnectInfo) {
      clearTimeout(disconnectInfo.timeoutId);
      this.disconnectedUsers.delete(userId);

      const disconnectDuration = Math.floor(
        (Date.now() - disconnectInfo.disconnectedAt) / 1000,
      );

      this.logger.log(
        `User ${userId} reconnected after ${disconnectDuration}s. Timeout cancelled.`,
      );

      return true;
    }

    return false;
  }

  /**
   * Clear disconnect timeout for user
   */
  clearDisconnectTimeout(userId: string): void {
    const disconnectInfo = this.disconnectedUsers.get(userId);
    if (disconnectInfo) {
      clearTimeout(disconnectInfo.timeoutId);
      this.disconnectedUsers.delete(userId);
    }
  }

  /**
   * Called when disconnect timeout expires
   */
  private async onDisconnectTimeout(
    userId: string,
    roomId: string,
  ): Promise<void> {
    this.logger.warn(
      `Disconnect timeout expired for user ${userId} in room ${roomId}`,
    );

    try {
      // Close the room due to connection loss
      await this.roomService.closeRoom(
        roomId,
        userId,
        'connection_lost' as any,
      );

      this.disconnectedUsers.delete(userId);
    } catch (error) {
      this.logger.error(`Error handling disconnect timeout: ${error.message}`);
    }
  }

  /**
   * Cron job: Close idle rooms every 2 minutes
   * Runs every 2 minutes
   */
  @Cron('0 */2 * * * *') // Every 2 minutes
  async handleIdleRoomCleanup(): Promise<void> {
    this.logger.debug('Running idle room cleanup...');

    try {
      const closedCount = await this.roomService.closeIdleRooms(
        this.IDLE_TIMEOUT_MINUTES,
      );

      if (closedCount > 0) {
        this.logger.log(`Closed ${closedCount} idle rooms`);
      }
    } catch (error) {
      this.logger.error(`Error in idle room cleanup: ${error.message}`);
    }
  }

  /**
   * Get current disconnect timeout status for user
   */
  getDisconnectStatus(userId: string): {
    isDisconnected: boolean;
    roomId?: string;
    secondsRemaining?: number;
  } {
    const info = this.disconnectedUsers.get(userId);

    if (!info) {
      return { isDisconnected: false };
    }

    const elapsed = Math.floor((Date.now() - info.disconnectedAt) / 1000);
    const remaining = Math.max(0, this.DISCONNECT_TIMEOUT_SECONDS - elapsed);

    return {
      isDisconnected: true,
      roomId: info.roomId,
      secondsRemaining: remaining,
    };
  }

  /**
   * Get all disconnected users (for debugging)
   */
  getDisconnectedUsers(): Map<string, any> {
    return new Map(
      Array.from(this.disconnectedUsers.entries()).map(([userId, info]) => [
        userId,
        {
          roomId: info.roomId,
          disconnectedAt: new Date(info.disconnectedAt).toISOString(),
          secondsElapsed: Math.floor((Date.now() - info.disconnectedAt) / 1000),
        },
      ]),
    );
  }

  /**
   * Clear all timeouts (for graceful shutdown)
   */
  clearAllTimeouts(): void {
    this.disconnectedUsers.forEach((info) => {
      clearTimeout(info.timeoutId);
    });
    this.disconnectedUsers.clear();
    this.logger.log('All disconnect timeouts cleared');
  }
}
