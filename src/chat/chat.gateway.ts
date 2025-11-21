// src/chat/chat.gateway.ts (Fixed)
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { MessageType } from './schemas/message.schema';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

interface SendMessageDto {
  conversationId: string;
  type: MessageType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
}

interface ReactMessageDto {
  messageId: string;
  emoji: string;
}

interface MarkAsReadDto {
  conversationId: string;
}

interface TypingDto {
  conversationId: string;
  isTyping?: boolean;
}

interface DeleteMessageDto {
  messageId: string;
}

interface UnmatchDto {
  conversationId: string;
}

interface BlockUserDto {
  conversationId: string;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online users: userId -> Set of socket IDs
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ===== CONNECTION MANAGEMENT =====

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      client.userId = payload.sub;
      client.user = await this.userModel
        .findById(payload.sub)
        .select('name photos')
        .lean();

      if (!client.userId || !client.user) {
        client.disconnect();
        return;
      }

      // Add to online users
      if (!this.onlineUsers.has(client.userId)) {
        this.onlineUsers.set(client.userId, new Set());
      }
      this.onlineUsers.get(client.userId)!.add(client.id);

      // Update lastActive
      await this.userModel.findByIdAndUpdate(client.userId, {
        lastActive: new Date(),
      });

      // Notify others that this user is online
      this.server.emit('user:online', {
        userId: client.userId,
        name: client.user.name,
      });

      console.log(`✅ User ${client.userId} connected (${client.id})`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    const userSockets = this.onlineUsers.get(client.userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.onlineUsers.delete(client.userId);

        // Update lastActive
        await this.userModel.findByIdAndUpdate(client.userId, {
          lastActive: new Date(),
        });

        // Notify others that this user is offline
        this.server.emit('user:offline', {
          userId: client.userId,
        });
      }
    }

    console.log(`❌ User ${client.userId} disconnected (${client.id})`);
  }

  // ===== HELPER: EMIT TO USER =====

  private emitToUser(userId: string, event: string, data: any) {
    const userSockets = this.onlineUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  // ===== JOIN CONVERSATION ROOM =====

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.join(`conversation:${data.conversationId}`);
    console.log(
      `User ${client.userId} joined conversation ${data.conversationId}`,
    );
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  // ===== SEND MESSAGE =====

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const message = await this.chatService.sendMessage(client.userId, dto);

      // Emit to conversation room
      this.server.to(`conversation:${dto.conversationId}`).emit('message:new', {
        conversationId: dto.conversationId,
        message: {
          _id: message._id,
          type: message.type,
          content: message.content,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          sender: {
            _id: message.sender._id,
            name: message.sender.name,
            photos: message.sender.photos,
          },
          isMine: false,
          createdAt: (message as any).createdAt,
        },
      });

      // Get conversation to find partner
      const conversation = await this.chatService.getConversationById(
        dto.conversationId,
        client.userId,
      );

      // Emit notification to partner
      this.emitToUser(conversation.partner._id.toString(), 'notification:new', {
        type: 'new_message',
        conversationId: dto.conversationId,
        sender: client.user,
        preview: message.content || 'Sent an attachment',
      });

      return { success: true, message };
    } catch (error: any) {
      client.emit('error', { message: error.message });
      return { success: false, error: error.message };
    }
  }

  // ===== TYPING INDICATOR =====

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId || !client.user) return;

    client.to(`conversation:${dto.conversationId}`).emit('typing:update', {
      conversationId: dto.conversationId,
      userId: client.userId,
      userName: client.user.name,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) return;

    client.to(`conversation:${dto.conversationId}`).emit('typing:update', {
      conversationId: dto.conversationId,
      userId: client.userId,
      isTyping: false,
    });
  }

  // ===== MARK AS READ =====

  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @MessageBody() dto: MarkAsReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.chatService.markAsRead(dto.conversationId, client.userId);

      // Notify partner
      client.to(`conversation:${dto.conversationId}`).emit('message:read', {
        conversationId: dto.conversationId,
        userId: client.userId,
        readAt: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== REACT TO MESSAGE =====

  @SubscribeMessage('message:react')
  async handleReactMessage(
    @MessageBody() dto: ReactMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId || !client.user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.chatService.reactToMessage(
        dto.messageId,
        client.userId,
        dto.emoji,
      );

      // Get message to find conversation
      const message = await this.chatService['messageModel']
        .findById(dto.messageId)
        .lean();

      if (!message) {
        return { success: false, error: 'Message not found' };
      }

      // Get all reactions for this message
      const reactions = await this.chatService['reactionModel']
        .find({ messageId: dto.messageId })
        .populate('userId', 'name')
        .lean();

      // Format reactions
      const formattedReactions = reactions.map((r: any) => ({
        userId: r.userId._id.toString(),
        userName: r.userId.name,
        emoji: r.emoji,
      }));

      // Emit to conversation room with full reaction data
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('message:reaction', {
          messageId: dto.messageId,
          conversationId: message.conversationId.toString(),
          reactions: formattedReactions, // ← Full reactions list
          action: {
            userId: client.userId,
            userName: client.user.name,
            emoji: dto.emoji,
          },
        });

      return { success: true, reactions: formattedReactions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== DELETE MESSAGE =====

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @MessageBody() dto: DeleteMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const message = await this.chatService['messageModel']
        .findById(dto.messageId)
        .lean();

      if (!message) {
        return { success: false, error: 'Message not found' };
      }

      await this.chatService.deleteMessage(dto.messageId, client.userId);

      // Emit to conversation room
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('message:deleted', {
          messageId: dto.messageId,
          conversationId: message.conversationId,
        });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== UNMATCH =====

  @SubscribeMessage('conversation:unmatch')
  async handleUnmatch(
    @MessageBody() dto: UnmatchDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const conversation = await this.chatService.getConversationById(
        dto.conversationId,
        client.userId,
      );

      await this.chatService.unmatch(dto.conversationId, client.userId);

      // Notify partner
      this.emitToUser(
        conversation.partner._id.toString(),
        'conversation:unmatched',
        {
          conversationId: dto.conversationId,
          unmatchedBy: client.userId,
        },
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== BLOCK USER =====

  @SubscribeMessage('user:block')
  async handleBlockUser(
    @MessageBody() dto: BlockUserDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.chatService.blockUser(dto.conversationId, client.userId);

      // Notify blocked user
      this.emitToUser(dto.userId, 'user:blocked', {
        conversationId: dto.conversationId,
        blockedBy: client.userId,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ===== GET ONLINE STATUS =====

  @SubscribeMessage('user:check-online')
  handleCheckOnline(
    @MessageBody() data: { userIds: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const onlineStatus = data.userIds.map((userId) => ({
      userId,
      isOnline: this.onlineUsers.has(userId),
    }));

    client.emit('user:online-status', onlineStatus);
  }
}
