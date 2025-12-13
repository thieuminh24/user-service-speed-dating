// src/matching/matching.service.ts - COMPLETE FIXED VERSION
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose'; // ← Import Types here
import { User } from '../users/schemas/user.schema';
import { BadRequestException } from 'src/common/exceptions/bad-request.exception';
import { Interaction, InteractionType } from './schemas/interaction.schema';
import { Match } from './schemas/match.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name); // ← Add logger

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Interaction.name) private interactionModel: Model<Interaction>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
    private eventEmitter: EventEmitter2,
  ) {}

  async getRecommendations(
    currentUserId: string,
    filters?: {
      minAge?: number;
      maxAge?: number;
      gender?: string;
    },
  ): Promise<any[]> {
    const currentUser = await this.userModel.findById(currentUserId);
    if (!currentUser) throw new NotFoundException('User not found');

    const myInteractions = await this.interactionModel
      .find({ fromUser: currentUserId })
      .select('toUser')
      .lean();

    const mongoose = require('mongoose');
    const excludedUserIds = myInteractions.map(
      (i) => new mongoose.Types.ObjectId(i.toUser),
    );
    excludedUserIds.push(new mongoose.Types.ObjectId(currentUserId));

    const query: any = {
      _id: { $nin: excludedUserIds },
      isDeleted: false,
      role: { $ne: 'admin' }, // Loại bỏ admin
    };

    // Các filter tuổi, giới tính...
    if (filters?.minAge || filters?.maxAge) {
      const currentYear = new Date().getFullYear();

      if (filters.minAge) {
        const maxBirthYear = currentYear - filters.minAge;
        query.dateOfBirth = {
          ...(query.dateOfBirth || {}),
          $lte: new Date(`${maxBirthYear}-12-31`),
        };
      }

      if (filters.maxAge) {
        const minBirthYear = currentYear - filters.maxAge;
        query.dateOfBirth = {
          ...(query.dateOfBirth || {}),
          $gte: new Date(`${minBirthYear}-01-01`),
        };
      }
    }

    if (filters?.gender) {
      query['basic.gender'] = filters.gender;
    }

    const users = await this.userModel
      .aggregate([
        { $match: query }, // query đã có điều kiện loại admin
        { $sample: { size: 30 } },
        {
          $project: {
            _id: 1,
            name: 1,
            dateOfBirth: 1,
            photos: 1,
            basic: 1,
            aboutMe: 1,
            prompts: 1,
            jobsAndEducation: 1,
            location: 1,
            isPhotoVerified: 1,
          },
        },
      ])
      .exec();

    return users.map((user) => {
      const age = user.dateOfBirth
        ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
        : null;

      return {
        _id: user._id,
        name: user.name,
        age,
        photos: user.photos || [],
        basic: user.basic,
        aboutMe: user.aboutMe,
        prompts: user.prompts,
        location: {
          lat: user.location?.coordinates[1],
          lon: user.location?.coordinates[0],
        },
        jobsAndEducation: user.jobsAndEducation,
      };
    });
  }

  async likeUser(currentUserId: string, targetUserId: string) {
    return this.handleInteraction(
      currentUserId,
      targetUserId,
      InteractionType.LIKE,
    );
  }

  async passUser(currentUserId: string, targetUserId: string) {
    return this.handleInteraction(
      currentUserId,
      targetUserId,
      InteractionType.PASS,
    );
  }

  private async handleInteraction(
    fromUserId: string,
    toUserId: string,
    type: InteractionType,
  ) {
    if (fromUserId === toUserId)
      throw new BadRequestException('Cannot interact with yourself');

    const fromUser = await this.userModel.findById(fromUserId).lean();
    const toUser = await this.userModel.findById(toUserId).lean();
    if (!fromUser || !toUser) throw new NotFoundException('User not found');

    const existing = await this.interactionModel.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
    });

    if (existing) {
      if (existing.type === type) {
        return { message: `Already ${type}d` };
      } else {
        existing.type = type;
        await existing.save();
      }
    } else {
      await this.interactionModel.create({
        fromUser: fromUserId,
        toUser: toUserId,
        type,
      });
    }

    if (type === InteractionType.LIKE) {
      const reverseLike = await this.interactionModel.findOne({
        fromUser: toUserId,
        toUser: fromUserId,
        type: InteractionType.LIKE,
      });

      if (reverseLike) {
        // Use findOneAndUpdate with upsert to prevent duplicate matches
        const match = await this.matchModel.findOneAndUpdate(
          {
            $or: [
              { user1: fromUserId, user2: toUserId },
              { user1: toUserId, user2: fromUserId },
            ],
          },
          {
            $setOnInsert: {
              user1: new Types.ObjectId(fromUserId),
              user2: new Types.ObjectId(toUserId),
              matchedAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
          },
        );

        // Only emit event if match was just created (not found existing)
        const isNewMatch = match.matchedAt.getTime() > Date.now() - 1000;

        if (isNewMatch) {
          this.logger.log(`New match created: ${match._id}`);

          // Emit match event
          this.eventEmitter.emit('match.created', {
            matchId: match._id,
            user1Id: fromUserId,
            user2Id: toUserId,
            user1: {
              _id: fromUser._id,
              name: fromUser.name,
              photos: fromUser.photos,
            },
            user2: {
              _id: toUser._id,
              name: toUser.name,
              photos: toUser.photos,
            },
          });
        } else {
          this.logger.log(`Match already existed: ${match._id}`);
        }

        return {
          message: "It's a match!",
          matchId: match._id,
          matchedUser: {
            _id: toUser._id,
            name: toUser.name,
            photos: toUser.photos,
          },
        };
      }
    }

    return { message: 'Success' };
  }

  async getMatches(userId: string) {
    const matches = await this.matchModel
      .find({
        $or: [{ user1: userId }, { user2: userId }],
        isDeleted: { $ne: true },
      })
      .populate({
        path: 'user1 user2',
        select: 'name photos',
        model: 'User',
      })
      .lean()
      .sort({ matchedAt: -1 })
      .exec();

    return matches.map((m: any) => {
      const partner = m.user1._id.toString() === userId ? m.user2 : m.user1;
      return {
        _id: m._id,
        partner: {
          _id: partner._id,
          name: partner.name,
          photos: partner.photos || [],
        },
        matchedAt: m.matchedAt,
      };
    });
  }

  async getLikesReceived(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const likes = await this.interactionModel
      .find({
        toUser: userId,
        type: InteractionType.LIKE,
      })
      .populate({
        path: 'fromUser',
        select:
          'name photos basic aboutMe prompts jobsAndEducation dateOfBirth',
        model: 'User',
      })
      .sort({ createdAt: -1 })
      .lean();

    const myInteractions = await this.interactionModel
      .find({ fromUser: userId })
      .lean();

    const myInteractionMap = new Map(
      myInteractions.map((i) => [i.toUser.toString(), i.type]),
    );

    return likes
      .filter(
        (like) => !myInteractionMap.has((like.fromUser as any)._id.toString()),
      )
      .map((like: any) => {
        const fromUser = like.fromUser;
        const age = fromUser.dateOfBirth
          ? new Date().getFullYear() -
            new Date(fromUser.dateOfBirth).getFullYear()
          : null;

        return {
          _id: fromUser._id,
          name: fromUser.name,
          age,
          photos: fromUser.photos || [],
          basic: fromUser.basic,
          aboutMe: fromUser.aboutMe,
          prompts: fromUser.prompts,
          jobsAndEducation: fromUser.jobsAndEducation,
          likedAt: like.createdAt,
        };
      });
  }
}
