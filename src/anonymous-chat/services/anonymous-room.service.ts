// src/anonymous-chat/services/anonymous-room.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AnonymousRoom,
  RoomStatus,
  DisconnectReason,
} from '../schemas/anonymous-room.schema';
import {
  AnonymousMessage,
  AnonymousMessageType,
} from '../schemas/anonymous-message.schema';
import { MatchmakingQueueService } from './matchmaking-queue.service';

@Injectable()
export class AnonymousRoomService {
  private readonly logger = new Logger(AnonymousRoomService.name);

  constructor(
    @InjectModel(AnonymousRoom.name) private roomModel: Model<AnonymousRoom>,
    @InjectModel(AnonymousMessage.name)
    private messageModel: Model<AnonymousMessage>,
    private matchmakingQueue: MatchmakingQueueService,
  ) {}

  /**
   * Create a new anonymous room after successful match
   */
  async createRoom(
    roomId: string,
    user1Id: string,
    user2Id: string,
    user1Name: string,
    user2Name: string,
  ): Promise<AnonymousRoom> {
    const room = await this.roomModel.create({
      roomId,
      user1: new Types.ObjectId(user1Id),
      user2: new Types.ObjectId(user2Id),
      user1AnonymousName: user1Name,
      user2AnonymousName: user2Name,
      status: RoomStatus.ACTIVE,
      lastActivityAt: new Date(),
      matchedAt: new Date(),
      messageCount: 0,
    });

    this.logger.log(`Room created: ${roomId}`);

    // Create system message
    await this.createSystemMessage(
      roomId,
      'Chat started! You are now connected anonymously.',
    );

    return room;
  }

  /**
   * Get room by roomId
   */
  async getRoomByRoomId(roomId: string): Promise<AnonymousRoom | null> {
    return this.roomModel.findOne({ roomId }).exec();
  }

  /**
   * Get user's active room
   */
  async getUserActiveRoom(userId: string): Promise<AnonymousRoom | null> {
    return this.roomModel
      .findOne({
        $or: [{ user1: userId }, { user2: userId }],
        status: RoomStatus.ACTIVE,
      })
      .exec();
  }

  /**
   * Get anonymous name for user in room
   */
  getAnonymousNameForUser(room: AnonymousRoom, userId: string): string {
    if (room.user1.toString() === userId) {
      return room.user1AnonymousName;
    } else if (room.user2.toString() === userId) {
      return room.user2AnonymousName;
    }
    throw new ForbiddenException('User not in room');
  }

  /**
   * Get partner's anonymous name
   */
  getPartnerAnonymousName(room: AnonymousRoom, userId: string): string {
    if (room.user1.toString() === userId) {
      return room.user2AnonymousName;
    } else if (room.user2.toString() === userId) {
      return room.user1AnonymousName;
    }
    throw new ForbiddenException('User not in room');
  }

  /**
   * Get partner's user ID
   */
  getPartnerId(room: AnonymousRoom, userId: string): string {
    if (room.user1.toString() === userId) {
      return room.user2.toString();
    } else if (room.user2.toString() === userId) {
      return room.user1.toString();
    }
    throw new ForbiddenException('User not in room');
  }

  /**
   * Update room activity timestamp
   */
  async updateActivity(roomId: string): Promise<void> {
    await this.roomModel.updateOne({ roomId }, { lastActivityAt: new Date() });
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(roomId: string): Promise<void> {
    await this.roomModel.updateOne(
      { roomId },
      { $inc: { messageCount: 1 }, lastActivityAt: new Date() },
    );
  }

  /**
   * Close room (user left or timeout)
   */
  async closeRoom(
    roomId: string,
    closedByUserId: string,
    reason: DisconnectReason,
  ): Promise<void> {
    const room = await this.getRoomByRoomId(roomId);
    if (!room) {
      this.logger.warn(`Room ${roomId} not found for closing`);
      return;
    }

    if (room.status !== RoomStatus.ACTIVE) {
      this.logger.warn(`Room ${roomId} already closed`);
      return;
    }

    // Update room status
    room.status =
      reason === DisconnectReason.IDLE_TIMEOUT
        ? RoomStatus.TIMEOUT
        : RoomStatus.CLOSED;
    room.closedAt = new Date();
    room.closedBy = new Types.ObjectId(closedByUserId);
    room.disconnectReason = reason;
    await room.save();

    // Create system message
    let systemMessage: string;
    switch (reason) {
      case DisconnectReason.USER_LEFT:
        systemMessage = 'You left the chat.';
        break;
      case DisconnectReason.PARTNER_LEFT:
        systemMessage = 'The other user has left the chat.';
        break;
      case DisconnectReason.IDLE_TIMEOUT:
        systemMessage = 'Chat closed due to inactivity.';
        break;
      case DisconnectReason.CONNECTION_LOST:
        systemMessage = 'Chat closed due to connection loss.';
        break;
      default:
        systemMessage = 'Chat has ended.';
    }

    await this.createSystemMessage(roomId, systemMessage);

    // Remove from Redis
    await this.matchmakingQueue.removeActiveRoom(roomId);
    await this.matchmakingQueue.removeUserRoom(room.user1.toString());
    await this.matchmakingQueue.removeUserRoom(room.user2.toString());

    this.logger.log(`Room ${roomId} closed. Reason: ${reason}`);
  }

  /**
   * Create a system message
   */
  private async createSystemMessage(
    roomId: string,
    content: string,
  ): Promise<void> {
    await this.messageModel.create({
      roomId,
      senderId: new Types.ObjectId('000000000000000000000000'), // System ID
      senderAnonymousName: 'System',
      type: AnonymousMessageType.SYSTEM,
      content,
    });
  }

  /**
   * Send a message in the room
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
  ): Promise<AnonymousMessage> {
    const room = await this.getRoomByRoomId(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== RoomStatus.ACTIVE) {
      throw new ForbiddenException('Room is not active');
    }

    // Verify user is in room
    const isParticipant =
      room.user1.toString() === senderId || room.user2.toString() === senderId;

    if (!isParticipant) {
      throw new ForbiddenException('User not in room');
    }

    const senderAnonymousName = this.getAnonymousNameForUser(room, senderId);

    const message = await this.messageModel.create({
      roomId,
      senderId: new Types.ObjectId(senderId),
      senderAnonymousName,
      type: AnonymousMessageType.TEXT,
      content,
    });

    // Update room activity and message count
    await this.incrementMessageCount(roomId);

    return message;
  }

  /**
   * Get messages for a room
   */
  async getMessages(
    roomId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<any> {
    const room = await this.getRoomByRoomId(roomId);
    if (!room) throw new NotFoundException('Room not found');

    // Verify user is in room
    const isParticipant =
      room.user1.toString() === userId || room.user2.toString() === userId;

    if (!isParticipant) {
      throw new ForbiddenException('Access denied');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ roomId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const total = await this.messageModel.countDocuments({
      roomId,
      isDeleted: false,
    });

    return {
      messages: messages.reverse().map((m) => ({
        _id: m._id,
        senderAnonymousName: m.senderAnonymousName,
        content: m.content,
        type: m.type,
        isMine: m.senderId.toString() === userId,
        createdAt: (m as any).createdAt || new Date(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      roomInfo: {
        status: room.status,
        yourAnonymousName: this.getAnonymousNameForUser(room, userId),
        partnerAnonymousName: this.getPartnerAnonymousName(room, userId),
        messageCount: room.messageCount,
      },
    };
  }

  /**
   * Find and close idle rooms (called by cron/scheduler)
   */
  async closeIdleRooms(idleMinutes: number = 5): Promise<number> {
    const idleThreshold = new Date(Date.now() - idleMinutes * 60 * 1000);

    const idleRooms = await this.roomModel.find({
      status: RoomStatus.ACTIVE,
      lastActivityAt: { $lt: idleThreshold },
    });

    for (const room of idleRooms) {
      await this.closeRoom(
        room.roomId,
        room.user1.toString(),
        DisconnectReason.IDLE_TIMEOUT,
      );
    }

    this.logger.log(`Closed ${idleRooms.length} idle rooms`);
    return idleRooms.length;
  }
}
