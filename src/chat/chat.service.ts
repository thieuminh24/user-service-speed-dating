// src/chat/chat.service.ts (Fixed)
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationStatus,
} from './schemas/conversation.schema';
import { Message, MessageStatus, MessageType } from './schemas/message.schema';
import { MessageReaction } from './schemas/message-reaction.schema';
import { Match } from '../matching/schemas/match.schema';

interface SendMessageDto {
  conversationId: string;
  type: MessageType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) public messageModel: Model<Message>,
    @InjectModel(MessageReaction.name)
    private reactionModel: Model<MessageReaction>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
  ) {}

  // ===== CONVERSATION =====

  async getOrCreateConversation(matchId: string): Promise<Conversation> {
    const match = await this.matchModel
      .findById(matchId)
      .populate('user1 user2');
    if (!match) throw new NotFoundException('Match not found');

    let conversation = await this.conversationModel.findOne({ matchId });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        matchId,
        participants: [match.user1, match.user2],
        status: ConversationStatus.ACTIVE,
        unreadCount: new Map(),
      });
    }

    return conversation;
  }

  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({
        participants: userId,
        status: { $ne: ConversationStatus.ARCHIVED },
      })
      .populate({
        path: 'participants',
        select: 'name photos lastActive',
      })
      .populate({
        path: 'lastMessage',
        select: 'content type sender createdAt isDeleted',
      })
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    return conversations
      .map((conv: any) => {
        const partner = conv.participants.find(
          (p: any) => p._id.toString() !== userId,
        );

        if (!partner) {
          return null;
        }

        return {
          _id: conv._id,
          matchId: conv.matchId,
          partner: {
            _id: partner._id,
            name: partner.name,
            photos: partner.photos || [],
            lastActive: partner.lastActive,
          },
          lastMessage: conv.lastMessage
            ? {
                _id: conv.lastMessage._id,
                content: conv.lastMessage.isDeleted
                  ? 'Message deleted'
                  : conv.lastMessage.content,
                type: conv.lastMessage.type,
                isMine: conv.lastMessage.sender.toString() === userId,
                createdAt: conv.lastMessage.createdAt,
              }
            : null,
          unreadCount:
            typeof conv.unreadCount === 'object'
              ? (conv.unreadCount as any)[userId] || 0
              : 0,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
        };
      })
      .filter(Boolean);
  }

  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<any> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate({
        path: 'participants',
        select: 'name photos lastActive',
      })
      .lean()
      .exec();

    if (!conversation) throw new NotFoundException('Conversation not found');

    // Kiểm tra user có phải participant không
    const isParticipant = conversation.participants.some(
      (p: any) => p._id.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const partner = conversation.participants.find(
      (p: any) => p._id.toString() !== userId,
    );

    if (!partner) throw new NotFoundException('Partner not found');

    return {
      _id: conversation._id,
      matchId: conversation.matchId,
      partner: {
        _id: (partner as any)._id,
        name: (partner as any).name,
        photos: (partner as any).photos || [],
        lastActive: (partner as any).lastActive,
      },
      status: conversation.status,
      unreadCount:
        typeof conversation.unreadCount === 'object'
          ? (conversation.unreadCount as any)[userId] || 0
          : 0,
    };
  }

  // ===== MESSAGES =====

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<Message & { sender: any }> {
    const conversation = await this.conversationModel.findById(
      dto.conversationId,
    );
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Kiểm tra quyền
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    // Kiểm tra conversation status
    if (conversation.status === ConversationStatus.BLOCKED) {
      throw new ForbiddenException('Cannot send message to blocked user');
    }

    // Tìm partner
    const partnerId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    if (!partnerId) throw new NotFoundException('Partner not found');

    // Tạo message
    const message = await this.messageModel.create({
      conversationId: dto.conversationId,
      sender: userId,
      type: dto.type,
      content: dto.content,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      replyTo: dto.replyTo,
      quizSessionId: (dto as any).quizSessionId, // ← NEW
      readStatus: new Map([
        [userId, MessageStatus.READ],
        [partnerId.toString(), MessageStatus.SENT],
      ]),
      readAt: new Map([[userId, new Date()]]),
    });

    // Update conversation
    const currentUnread =
      conversation.unreadCount.get(partnerId.toString()) || 0;
    conversation.unreadCount.set(partnerId.toString(), currentUnread + 1);
    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate sender info
    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name photos')
      .lean()
      .exec();

    return populatedMessage as any;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<any> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({
        conversationId,
        isDeleted: false,
      })
      .populate('sender', 'name photos')
      .populate('replyTo', 'content sender type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    // Get reactions for messages
    const messageIds = messages.map((m: any) => m._id);
    const reactions = await this.reactionModel
      .find({ messageId: { $in: messageIds } })
      .populate('userId', 'name')
      .lean()
      .exec();

    // Group reactions by message
    const reactionsMap = new Map();
    reactions.forEach((r: any) => {
      if (!reactionsMap.has(r.messageId.toString())) {
        reactionsMap.set(r.messageId.toString(), []);
      }
      reactionsMap.get(r.messageId.toString()).push({
        userId: r.userId._id,
        userName: r.userId.name,
        emoji: r.emoji,
      });
    });

    const total = await this.messageModel.countDocuments({
      conversationId,
      isDeleted: false,
    });

    return {
      messages: messages.reverse().map((m: any) => {
        // Get read status for current user
        let readStatus = MessageStatus.SENT;
        if (typeof m.readStatus === 'object') {
          const statusMap =
            m.readStatus instanceof Map
              ? m.readStatus
              : new Map(Object.entries(m.readStatus));
          readStatus = statusMap.get(userId) || MessageStatus.SENT;
        }

        return {
          _id: m._id,
          type: m.type,
          content: m.content,
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          sender: {
            _id: m.sender._id,
            name: m.sender.name,
            photos: m.sender.photos,
          },
          isMine: m.sender._id.toString() === userId,
          replyTo: m.replyTo,
          reactions: reactionsMap.get(m._id.toString()) || [],
          readStatus: readStatus,
          createdAt: m.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    message.isDeleted = true;
    message.deletedBy = new Types.ObjectId(userId);
    message.deletedAt = new Date();
    await message.save();
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Reset unread count
    const unreadMap =
      conversation.unreadCount instanceof Map
        ? conversation.unreadCount
        : new Map(Object.entries(conversation.unreadCount || {}));

    unreadMap.set(userId, 0);
    conversation.unreadCount = unreadMap as any;
    await conversation.save();

    // Update all unread messages
    await this.messageModel.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        [`readStatus.${userId}`]: { $ne: MessageStatus.READ },
      },
      {
        $set: {
          [`readStatus.${userId}`]: MessageStatus.READ,
          [`readAt.${userId}`]: new Date(),
        },
      },
    );
  }

  // ===== REACTIONS =====

  async reactToMessage(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    // Check if already reacted
    const existing = await this.reactionModel.findOne({ messageId, userId });

    if (existing) {
      if (existing.emoji === emoji) {
        // Remove reaction
        await this.reactionModel.deleteOne({ _id: existing._id });
        message.reactionsCount = Math.max(0, message.reactionsCount - 1);
      } else {
        // Update reaction
        existing.emoji = emoji;
        await existing.save();
      }
    } else {
      // Add new reaction
      await this.reactionModel.create({ messageId, userId, emoji });
      message.reactionsCount += 1;
    }

    await message.save();
  }

  // ===== UNMATCH & BLOCK =====

  async unmatch(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    conversation.status = ConversationStatus.ARCHIVED;
    conversation.unmatchedBy = new Types.ObjectId(userId);
    conversation.unmatchedAt = new Date();
    await conversation.save();

    // Soft delete match
    await this.matchModel.findByIdAndUpdate(conversation.matchId, {
      isDeleted: true,
    });
  }

  async blockUser(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const userObjectId = new Types.ObjectId(userId);
    if (!conversation.blockedBy.some((id) => id.equals(userObjectId))) {
      conversation.blockedBy.push(userObjectId);
    }
    conversation.status = ConversationStatus.BLOCKED;
    await conversation.save();
  }

  async unblockUser(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    conversation.blockedBy = conversation.blockedBy.filter(
      (id) => id.toString() !== userId,
    );

    if (conversation.blockedBy.length === 0) {
      conversation.status = ConversationStatus.ACTIVE;
    }
    await conversation.save();
  }

  // ===== SEND QUIZ INVITE =====
  async sendQuizInvite(
    conversationId: string,
    userId: string,
    quizSessionId: string,
  ): Promise<any> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const partnerId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    if (!partnerId) throw new NotFoundException('Partner not found');

    // Create quiz invite message
    const message = await this.messageModel.create({
      conversationId,
      sender: userId,
      type: 'quiz_invite',
      content: '📝 Invited you to take a compatibility quiz!',
      quizSessionId,
      readStatus: new Map([
        [userId, MessageStatus.READ],
        [partnerId.toString(), MessageStatus.SENT],
      ]),
      readAt: new Map([[userId, new Date()]]),
    });

    // Update conversation
    const currentUnread =
      conversation.unreadCount.get(partnerId.toString()) || 0;
    conversation.unreadCount.set(partnerId.toString(), currentUnread + 1);
    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate sender
    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name photos')
      .lean()
      .exec();

    return populatedMessage;
  }
}
