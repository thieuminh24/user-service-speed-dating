// src/matching/matching.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { CompatibilityService } from './compatibility.service';
import { BadRequestException } from 'src/common/exceptions/bad-request.exception';
import { Interaction, InteractionType } from './schemas/interaction.schema';
import { Match } from './schemas/match.schema';

@Injectable()
export class MatchingService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Interaction.name) private interactionModel: Model<Interaction>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
    private compatibilityService: CompatibilityService,
  ) {}

  async getRecommendations(
    currentUserId: string,
    maxDistance = 50,
  ): Promise<any[]> {
    const currentUser = await this.userModel.findById(currentUserId);
    if (!currentUser) throw new NotFoundException('User not found');

    if (!currentUser.location?.coordinates) {
      throw new BadRequestException('Your location is missing');
    }

    const currentNum = currentUser.numerologyNumber;
    const currentSign = currentUser.basic.starSign;
    if (currentNum === null || !currentSign) {
      throw new BadRequestException(
        'Please complete your profile (DOB required)',
      );
    }

    const [lon, lat] = currentUser.location.coordinates;

    const pipeline: any[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lon, lat] },
          distanceField: 'dist.calculated',
          maxDistance: maxDistance * 1000,
          spherical: true,
          query: {
            _id: { $ne: currentUserId },
            isDeleted: false,
            numerologyNumber: { $ne: null },
            starSign: { $ne: null },
          },
        },
      },
      { $limit: 30 },
    ];

    const candidates = await this.userModel.aggregate(pipeline).exec();

    const recommendations = candidates
      .map((c) => {
        const numScore = this.compatibilityService.getNumerologyScore(
          currentNum,
          c.numerologyNumber,
        );
        const zodiacScore = this.compatibilityService.getZodiacScore(
          currentSign,
          c.starSign,
        );
        const distanceKm = Math.round(c.dist.calculated / 1000);
        const locationScore = Math.max(0, 10 - distanceKm / 5);

        // CÂN BẰNG LẠI TRỌNG SỐ (TỔNG = 100%)
        const totalScore = Math.round(
          numScore * 0.25 + // Numerology: 25%
            zodiacScore * 0.25 + // Zodiac: 25%
            locationScore * 0.5, // Location: 50%
        );

        const age = c.dateOfBirth
          ? new Date().getFullYear() - new Date(c.dateOfBirth).getFullYear()
          : null;

        return {
          _id: c._id,
          name: c.name,
          age,
          photos: c.photos || [],
          basic: c.basic,
          aboutMe: c.aboutMe,
          prompts: c.prompts,
          jobs: c.jobs,
          education: c.education,
          compatibilityScore: totalScore,
          numerologyNumber: c.numerologyNumber,
          distance: distanceKm,
          numerologyScore: numScore,
          zodiacScore: zodiacScore,
          locationScore: Math.round(locationScore),
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    return recommendations;
  }

  async likeUser(currentUserId: string, targetUserId: string) {
    return this.handleInteraction(
      currentUserId,
      targetUserId,
      InteractionType.LIKE,
    );
  }

  // PASS USER
  async passUser(currentUserId: string, targetUserId: string) {
    return this.handleInteraction(
      currentUserId,
      targetUserId,
      InteractionType.PASS,
    );
  }

  // XỬ LÝ LIKE/PASS
  private async handleInteraction(
    fromUserId: string,
    toUserId: string,
    type: InteractionType,
  ) {
    if (fromUserId === toUserId)
      throw new BadRequestException('Cannot interact with yourself');

    const fromUser = await this.userModel.findById(fromUserId);
    const toUser = await this.userModel.findById(toUserId);
    if (!fromUser || !toUser) throw new NotFoundException('User not found');

    // Kiểm tra đã tương tác chưa
    const existing = await this.interactionModel.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
    });

    if (existing) {
      if (existing.type === type) {
        return { message: `Already ${type}d` };
      } else {
        // Cập nhật từ pass → like
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

    // Nếu là LIKE → kiểm tra có match không
    if (type === InteractionType.LIKE) {
      const reverseLike = await this.interactionModel.findOne({
        fromUser: toUserId,
        toUser: fromUserId,
        type: InteractionType.LIKE,
      });

      if (reverseLike) {
        // TẠO MATCH
        const match = await this.matchModel.findOneAndUpdate(
          {
            $or: [
              { user1: fromUserId, user2: toUserId },
              { user1: toUserId, user2: fromUserId },
            ],
          },
          {
            user1: fromUserId,
            user2: toUserId,
          },
          { upsert: true, new: true },
        );

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

  // LẤY DANH SÁCH MATCH
  async getMatches(userId: string) {
    const matches = await this.matchModel
      .find({
        $or: [{ user1: userId }, { user2: userId }],
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
}
