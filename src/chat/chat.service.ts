// src/chat/chat.service.ts - ULTIMATE FIX FOR DUPLICATES

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
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
import { OnEvent } from '@nestjs/event-emitter';

interface SendMessageDto {
  conversationId: string;
  type: MessageType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
  quizSessionId?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) public messageModel: Model<Message>,
    @InjectModel(MessageReaction.name)
    private reactionModel: Model<MessageReaction>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
  ) {}

  // ===== AUTO CREATE CONVERSATION WHEN MATCH =====
  @OnEvent('match.created')
  async handleMatchCreated(payload: {
    matchId: string;
    user1Id: string;
    user2Id: string;
  }) {
    this.logger.log(`🎯 Match created event: ${payload.matchId}`);

    try {
      // ===== CRITICAL: Check if conversation already exists first =====
      const existing = await this.conversationModel.findOne({
        matchId: new Types.ObjectId(payload.matchId),
      });

      if (existing) {
        this.logger.log(`⚠️ Conversation already exists: ${existing._id}`);
        return;
      }

      // ===== Create new conversation with unique constraint =====
      const conversation = await this.conversationModel.create({
        matchId: new Types.ObjectId(payload.matchId),
        participants: [
          new Types.ObjectId(payload.user1Id),
          new Types.ObjectId(payload.user2Id),
        ],
        status: ConversationStatus.ACTIVE,
        unreadCount: new Map(),
      });

      this.logger.log(`✅ Conversation created: ${conversation._id}`);
    } catch (error) {
      // If duplicate key error (E11000), just log and continue
      if (error.code === 11000) {
        this.logger.log('⚠️ Duplicate conversation prevented by unique index');
      } else {
        this.logger.error(`❌ Failed to create conversation: ${error.message}`);
      }
    }
  }

  // ===== GET CONVERSATIONS - WITH DEDUPLICATION =====
  async getConversations(userId: string): Promise<any[]> {
    this.logger.log(`📋 Getting conversations for user ${userId}`);

    // ===== STEP 1: Remove duplicates in database =====
    await this.removeDuplicateConversations(userId);

    // ===== STEP 2: Get unique conversations =====
    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        status: { $ne: ConversationStatus.ARCHIVED },
      })
      .lean({ virtuals: true }) // Quan trọng!
      .populate({
        path: 'participants',
        select: 'name photos lastActive',
      })
      .populate({
        path: 'lastMessage',
        select: 'content type sender createdAt isDeleted',
      })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();
    this.logger.log(`📊 Found ${conversations.length} conversations`);

    // ===== STEP 3: Deduplicate by matchId in memory (safety net) =====
    const uniqueConversations = new Map();

    for (const conv of conversations) {
      const matchIdStr = conv.matchId.toString();

      // If we already have this matchId, keep the one with messages
      if (uniqueConversations.has(matchIdStr)) {
        const existing = uniqueConversations.get(matchIdStr);

        // Prefer conversation with lastMessage
        if (conv.lastMessage && !existing.lastMessage) {
          uniqueConversations.set(matchIdStr, conv);
        }
      } else {
        uniqueConversations.set(matchIdStr, conv);
      }
    }

    // ===== STEP 4: Format results =====
    return Array.from(uniqueConversations.values())
      .map((conv: any) => {
        const partner = conv.participants.find(
          (p: any) => p._id.toString() !== userId,
        );

        if (!partner) {
          this.logger.warn(`⚠️ No partner found for conversation ${conv._id}`);
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
          lastMessageAt: conv.lastMessageAt || conv.createdAt,
        };
      })
      .filter(Boolean);
  }

  // ===== HELPER: Remove duplicate conversations =====
  private async removeDuplicateConversations(userId: string): Promise<void> {
    try {
      // Find all conversations for this user
      const allConversations = await this.conversationModel
        .find({
          participants: new Types.ObjectId(userId),
        })
        .select('_id matchId lastMessage createdAt')
        .lean();

      // Group by matchId
      const groupedByMatch = new Map<string, any[]>();

      for (const conv of allConversations) {
        const matchIdStr = conv.matchId.toString();
        if (!groupedByMatch.has(matchIdStr)) {
          groupedByMatch.set(matchIdStr, []);
        }
        groupedByMatch.get(matchIdStr)!.push(conv);
      }

      // Find duplicates and delete extras
      for (const [matchId, convs] of groupedByMatch.entries()) {
        if (convs.length > 1) {
          this.logger.log(
            `🔍 Found ${convs.length} conversations for match ${matchId}`,
          );

          // Sort by priority: 1. Has messages, 2. Oldest
          const sorted = convs.sort((a, b) => {
            // Prefer conversation with messages
            if (a.lastMessage && !b.lastMessage) return -1;
            if (!a.lastMessage && b.lastMessage) return 1;

            // Then prefer oldest
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });

          // Keep first, delete rest
          const toKeep = sorted[0];
          const toDelete = sorted.slice(1).map((c) => c._id);

          if (toDelete.length > 0) {
            await this.conversationModel.deleteMany({
              _id: { $in: toDelete },
            });

            this.logger.log(
              `🗑️ Deleted ${toDelete.length} duplicate conversations for match ${matchId}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error removing duplicates: ${error.message}`);
    }
  }

  // ===== CONVERSATION =====

  async getOrCreateConversation(matchId: string): Promise<Conversation> {
    const match = await this.matchModel
      .findById(matchId)
      .populate('user1 user2');
    if (!match) throw new NotFoundException('Match not found');

    // Try to find existing conversation
    let conversation = await this.conversationModel.findOne({
      matchId: new Types.ObjectId(matchId),
    });

    if (!conversation) {
      // Create new conversation
      try {
        conversation = await this.conversationModel.create({
          matchId: new Types.ObjectId(matchId),
          participants: [match.user1, match.user2],
          status: ConversationStatus.ACTIVE,
          unreadCount: new Map(),
        });
      } catch (error) {
        // If duplicate error, find the existing one
        if (error.code === 11000) {
          conversation = await this.conversationModel.findOne({
            matchId: new Types.ObjectId(matchId),
          });
          if (!conversation)
            throw new NotFoundException('Conversation not found');
        } else {
          throw error;
        }
      }
    }

    return conversation;
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
      .populate({
        path: 'matchId',
        select: '_id',
      })
      .lean()
      .exec();

    if (!conversation) throw new NotFoundException('Conversation not found');

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
      matchId: (conversation.matchId as any)?._id || conversation.matchId,
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

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new ForbiddenException('Access denied');

    if (conversation.status === ConversationStatus.BLOCKED) {
      throw new ForbiddenException('Cannot send message to blocked user');
    }

    const partnerId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    if (!partnerId) throw new NotFoundException('Partner not found');

    const message = await this.messageModel.create({
      conversationId: dto.conversationId,
      sender: userId,
      type: dto.type,
      content: dto.content,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      replyTo: dto.replyTo,
      quizSessionId: dto.quizSessionId,
      readStatus: new Map([
        [userId, MessageStatus.READ],
        [partnerId.toString(), MessageStatus.SENT],
      ]),
      readAt: new Map([[userId, new Date()]]),
    });

    const currentUnread =
      conversation.unreadCount.get(partnerId.toString()) || 0;
    conversation.unreadCount.set(partnerId.toString(), currentUnread + 1);
    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

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

    const messageIds = messages.map((m: any) => m._id);
    const reactions = await this.reactionModel
      .find({ messageId: { $in: messageIds } })
      .populate('userId', 'name')
      .lean()
      .exec();

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
          quizSessionId: m.quizSessionId,
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

    const unreadMap =
      conversation.unreadCount instanceof Map
        ? conversation.unreadCount
        : new Map(Object.entries(conversation.unreadCount || {}));

    unreadMap.set(userId, 0);
    conversation.unreadCount = unreadMap as any;
    await conversation.save();

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

    const existing = await this.reactionModel.findOne({ messageId, userId });

    if (existing) {
      if (existing.emoji === emoji) {
        await this.reactionModel.deleteOne({ _id: existing._id });
        message.reactionsCount = Math.max(0, message.reactionsCount - 1);
      } else {
        existing.emoji = emoji;
        await existing.save();
      }
    } else {
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
    this.logger.log(
      `Sending quiz invite: conversation=${conversationId}, session=${quizSessionId}`,
    );

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

    const message = await this.messageModel.create({
      conversationId,
      sender: userId,
      type: 'quiz_invite' as MessageType,
      content: '📝 Invited you to take a compatibility quiz!',
      quizSessionId,
      readStatus: new Map([
        [userId, MessageStatus.READ],
        [partnerId.toString(), MessageStatus.SENT],
      ]),
      readAt: new Map([[userId, new Date()]]),
    });

    const currentUnread =
      conversation.unreadCount.get(partnerId.toString()) || 0;
    conversation.unreadCount.set(partnerId.toString(), currentUnread + 1);
    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name photos')
      .lean()
      .exec();

    this.logger.log(`Quiz invite message created: ${message._id}`);
    return populatedMessage;
  }
}
