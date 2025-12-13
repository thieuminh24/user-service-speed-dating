// src/anonymous-chat/anonymous-chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { AnonymousChatService } from './services/anonymous-chat.service';
import { AnonymousRoomService } from './services/anonymous-room.service';
import type { AuthenticatedSocket } from './interfaces/authenticated-socket.interface';
import {
  LeaveRoomDto,
  SendAnonymousMessageDto,
  TypingDto,
} from './dto/start-matching.dto';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/anonymous-chat', // Separate namespace
})
export class AnonymousChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AnonymousChatGateway.name);

  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<string, Set<string>>();

  // Track which room each socket is in: socketId -> roomId
  private socketRooms = new Map<string, string>();

  constructor(
    private readonly anonymousChatService: AnonymousChatService,
    private readonly roomService: AnonymousRoomService,
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ===== CONNECTION MANAGEMENT =====

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'abc',
      });

      client.userId = payload.sub;
      client.user = await this.userModel
        .findById(payload.sub)
        .select('name')
        .lean();

      if (!client.userId || !client.user) {
        this.logger.warn('Invalid user');
        client.disconnect();
        return;
      }

      // Track online status
      if (!this.onlineUsers.has(client.userId)) {
        this.onlineUsers.set(client.userId, new Set());
      }
      this.onlineUsers.get(client.userId)!.add(client.id);

      // Check if user has active room and rejoin
      const currentRoom = await this.anonymousChatService.getCurrentRoom(
        client.userId,
      );

      if (currentRoom) {
        client.join(`room:${currentRoom.roomId}`);
        this.socketRooms.set(client.id, currentRoom.roomId);
        client.currentRoomId = currentRoom.roomId;

        // Handle reconnection
        const wasDisconnected = this.anonymousChatService.handleReconnect(
          client.userId,
        );

        if (wasDisconnected) {
          // Notify partner of reconnection
          client.to(`room:${currentRoom.roomId}`).emit('partner:reconnected', {
            roomId: currentRoom.roomId,
            message: 'Partner has reconnected',
          });
        }

        // Send current room info
        client.emit('room:rejoined', currentRoom);
      }

      this.logger.log(`✅ User ${client.userId} connected (${client.id})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    // Remove from online tracking
    const userSockets = this.onlineUsers.get(client.userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.onlineUsers.delete(client.userId);

        // If user has active room, start disconnect timeout
        const roomId = this.socketRooms.get(client.id);
        if (roomId) {
          this.anonymousChatService.handleDisconnect(client.userId, roomId);

          // Notify partner
          client.to(`room:${roomId}`).emit('partner:disconnected', {
            roomId,
            message: 'Partner disconnected. Waiting for reconnection...',
          });

          this.logger.log(
            `User ${client.userId} disconnected from room ${roomId}. Timeout started.`,
          );
        }
      }
    }

    this.socketRooms.delete(client.id);
    this.logger.log(`❌ User ${client.userId} disconnected (${client.id})`);
  }

  // ===== MATCHMAKING =====

  @SubscribeMessage('matching:start')
  async handleStartMatching(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await this.anonymousChatService.startMatching(
        client.userId,
        client.id,
      );

      this.logger.log(`User ${client.userId} joined queue`);

      // Try to process match immediately
      setTimeout(() => this.processMatching(), 100);

      return result;
    } catch (error: any) {
      this.logger.error(`Start matching error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('matching:cancel')
  async handleCancelMatching(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await this.anonymousChatService.cancelMatching(
        client.userId,
      );
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process matchmaking - try to create matches
   */
  private async processMatching() {
    try {
      const matchResult = await this.anonymousChatService.processMatchmaking();

      if (matchResult) {
        const { roomId, user1, user2 } = matchResult;

        this.logger.log(`Match created: ${roomId}`);

        // Get socket IDs
        const user1Sockets = this.onlineUsers.get(user1.userId);
        const user2Sockets = this.onlineUsers.get(user2.userId);

        this.logger.debug(`User1 sockets: ${user1Sockets?.size || 0}`);
        this.logger.debug(`User2 sockets: ${user2Sockets?.size || 0}`);

        if (!user1Sockets || !user2Sockets) {
          this.logger.warn(
            `Cannot emit match: user1Sockets=${!!user1Sockets}, user2Sockets=${!!user2Sockets}`,
          );
          return;
        }

        // Verify server.sockets exists
        if (!this.server || !this.server.sockets) {
          this.logger.error('Server or server.sockets is undefined');
          return;
        }

        // Join both users to room
        user1Sockets.forEach((socketId) => {
          try {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
              socket.join(`room:${roomId}`);
              this.socketRooms.set(socketId, roomId);
              this.logger.debug(`User1 socket ${socketId} joined room`);
            } else {
              this.logger.warn(`User1 socket ${socketId} not found`);
            }
          } catch (error) {
            this.logger.error(`Error joining user1 socket: ${error.message}`);
          }
        });

        user2Sockets.forEach((socketId) => {
          try {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
              socket.join(`room:${roomId}`);
              this.socketRooms.set(socketId, roomId);
              this.logger.debug(`User2 socket ${socketId} joined room`);
            } else {
              this.logger.warn(`User2 socket ${socketId} not found`);
            }
          } catch (error) {
            this.logger.error(`Error joining user2 socket: ${error.message}`);
          }
        });

        // Emit match found to both users
        this.emitToUser(user1.userId, 'match:found', {
          roomId,
          yourAnonymousName: user1.anonymousName,
          partnerAnonymousName: user2.anonymousName,
        });

        this.emitToUser(user2.userId, 'match:found', {
          roomId,
          yourAnonymousName: user2.anonymousName,
          partnerAnonymousName: user1.anonymousName,
        });

        this.logger.log(
          `✅ Match emitted: ${user1.anonymousName} & ${user2.anonymousName}`,
        );

        // Try to process next match
        setTimeout(() => this.processMatching(), 100);
      }
    } catch (error) {
      this.logger.error(`Process matching error: ${error.message}`);
      console.error('Full error:', error);
    }
  }

  // ===== ROOM ACTIONS =====

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.join(`room:${data.roomId}`);
    this.socketRooms.set(client.id, data.roomId);
    client.currentRoomId = data.roomId;
    this.logger.log(`User ${client.userId} joined room ${data.roomId}`);
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @MessageBody() dto: LeaveRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await this.anonymousChatService.leaveRoom(
        client.userId,
        dto.roomId,
      );

      // Notify partner
      client.to(`room:${dto.roomId}`).emit('partner:left', {
        roomId: dto.roomId,
        message: 'The other user has left the chat.',
      });

      // Leave socket room
      client.leave(`room:${dto.roomId}`);
      this.socketRooms.delete(client.id);
      client.currentRoomId = undefined;

      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== MESSAGING =====

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @MessageBody() dto: SendAnonymousMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const message = await this.anonymousChatService.sendMessage(
        client.userId,
        dto.roomId,
        dto.content,
      );

      // Emit to room
      this.server.to(`room:${dto.roomId}`).emit('message:new', {
        roomId: dto.roomId,
        messageId: message._id,
        senderAnonymousName: message.senderAnonymousName,
        content: message.content,
        createdAt: (message as any).createdAt || new Date(),
        isMine: false, // Will be corrected by client based on anonymousName
      });

      return { success: true, message };
    } catch (error: any) {
      this.logger.error(`Send message error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ===== TYPING INDICATOR =====

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    client.to(`room:${dto.roomId}`).emit('typing:update', {
      roomId: dto.roomId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    client.to(`room:${dto.roomId}`).emit('typing:update', {
      roomId: dto.roomId,
      isTyping: false,
    });
  }

  // ===== HELPER METHODS =====

  private emitToUser(userId: string, event: string, data: any) {
    const userSockets = this.onlineUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }
}
