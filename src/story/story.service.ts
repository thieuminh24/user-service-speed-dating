// src/story/story.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryType } from './schemas/story.schema';
import { User } from '../users/schemas/user.schema';
import { Match } from '../matching/schemas/match.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateTextStoryDto, CreateVideoStoryDto } from './dto/story.dto';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<Story>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
    private cloudinaryService: CloudinaryService,
  ) {}

  // CREATE TEXT STORY
  async createTextStory(userId: string, dto: CreateTextStoryDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const story = await this.storyModel.create({
      userId,
      type: StoryType.TEXT,
      text: dto.text,
      textColor: dto.textColor || '#FFFFFF',
      fontFamily: dto.fontFamily || 'Inter',
      fontSize: dto.fontSize || 32,
      textAlign: dto.textAlign || 'center',
      textBold: dto.textBold || false,
      textItalic: dto.textItalic || false,
      backgroundColor:
        dto.backgroundColor ||
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    });

    return {
      _id: story._id,
      type: story.type,
      text: story.text,
      textColor: story.textColor,
      fontFamily: story.fontFamily,
      fontSize: story.fontSize,
      textAlign: story.textAlign,
      textBold: story.textBold,
      textItalic: story.textItalic,
      backgroundColor: story.backgroundColor,
      expiresAt: story.expiresAt,
      createdAt: (story as any).createdAt,
    };
  }

  // CREATE VIDEO STORY
  async createVideoStory(
    userId: string,
    dto: CreateVideoStoryDto,
    videoFile: Express.Multer.File,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!videoFile) {
      throw new BadRequestException('Video file is required');
    }

    // Upload video to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(videoFile);

    const story = await this.storyModel.create({
      userId,
      type: StoryType.VIDEO,
      videoUrl: uploadResult.secure_url,
      thumbnailUrl: uploadResult.secure_url.replace(/\.[^.]+$/, '.jpg'), // Cloudinary auto-generates thumbnail
      videoDuration: dto.videoDuration,
    });

    return {
      _id: story._id,
      type: story.type,
      videoUrl: story.videoUrl,
      thumbnailUrl: story.thumbnailUrl,
      videoDuration: story.videoDuration,
      expiresAt: story.expiresAt,
      createdAt: (story as any).createdAt,
    };
  }

  // GET MY STORIES
  async getMyStories(userId: string) {
    const stories = await this.storyModel
      .find({
        userId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .lean();

    return stories;
  }

  // GET STORIES FROM MATCHED USERS
  async getMatchedUsersStories(currentUserId: string) {
    const matches = await this.matchModel
      .find({
        isDeleted: false,
        $or: [
          { user1: new Types.ObjectId(currentUserId) },
          { user2: new Types.ObjectId(currentUserId) },
        ],
      })
      .lean();

    console.log('matches', matches);

    // Get matched user IDs
    const matchedUserIds = matches.map((m) =>
      m.user1.toString() === currentUserId
        ? m.user2.toString()
        : m.user1.toString(),
    );

    if (matchedUserIds.length === 0) {
      return [];
    }

    // Get stories from matched users (not expired, not deleted)
    const stories = await this.storyModel
      .find({
        userId: { $in: matchedUserIds },
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .populate('userId', 'name photos')
      .sort({ createdAt: -1 })
      .lean();

    // Group by user
    const storiesByUser = stories.reduce((acc, story) => {
      const userId = (story.userId as any)._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: {
            _id: (story.userId as any)._id,
            name: (story.userId as any).name,
            avatar: (story.userId as any).photos[0] || '',
          },
          stories: [],
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    return Object.values(storiesByUser);
  }

  // GET SINGLE STORY (with privacy check)
  async getStory(storyId: string, currentUserId: string) {
    const story = await this.storyModel
      .findById(storyId)
      .populate('userId', 'name photos')
      .lean();

    if (!story || story.isDeleted || new Date() > story.expiresAt) {
      throw new NotFoundException('Story not found or expired');
    }

    // Check if viewer is the owner
    if (story.userId._id.toString() === currentUserId) {
      return story;
    }

    // Check if viewer is matched with owner
    const isMatched = await this.matchModel.findOne({
      $or: [
        { user1: currentUserId, user2: story.userId },
        { user1: story.userId, user2: currentUserId },
      ],
      isDeleted: false,
    });

    if (!isMatched) {
      throw new ForbiddenException(
        'You can only view stories from matched users',
      );
    }

    return story;
  }

  // MARK STORY AS VIEWED
  async viewStory(storyId: string, viewerId: string) {
    const viewerObjectId = new Types.ObjectId(viewerId);
    const storyObjectId = new Types.ObjectId(storyId);

    // Update atomic: Chỉ tăng nếu chưa xem, không phải chủ, và story hợp lệ
    const result = await this.storyModel.findOneAndUpdate(
      {
        _id: storyObjectId,
        expiresAt: { $gt: new Date() },
        isDeleted: false,
        userId: { $ne: viewerObjectId }, // Không phải chủ story
        viewedBy: { $ne: viewerObjectId }, // Chưa xem
      },
      {
        $addToSet: { viewedBy: viewerObjectId }, // Tự động không thêm nếu đã có
        $inc: { viewCount: 1 },
      },
      { new: true }, // Trả về document sau update để lấy viewCount mới
    );

    if (!result) {
      // Kiểm tra lý do không update
      const story = await this.storyModel.findById(storyObjectId);
      if (!story || story.isDeleted || new Date() > story.expiresAt) {
        throw new NotFoundException('Story not found or expired');
      }
      return {
        message: 'Already viewed or owner',
        viewCount: story?.viewCount || 0,
      };
    }

    return { message: 'Story viewed', viewCount: result.viewCount };
  }

  // DELETE STORY
  async deleteStory(storyId: string, userId: string) {
    const story = await this.storyModel.findById(storyId);

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    story.isDeleted = true;
    await story.save();

    // If video, delete from Cloudinary
    if (story.type === StoryType.VIDEO && story.videoUrl) {
      const publicId = this.extractPublicId(story.videoUrl);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId);
      }
    }

    return { message: 'Story deleted' };
  }

  // GET STORY VIEWERS
  async getStoryViewers(storyId: string, userId: string) {
    const story = await this.storyModel.findById(storyId).lean();

    if (!story || story.isDeleted || new Date() > story.expiresAt) {
      throw new NotFoundException('Story not found or expired');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    // DÙNG aggregate + $lookup → chắc chắn populate được
    const result = await this.storyModel.aggregate([
      { $match: { _id: new Types.ObjectId(storyId) } },
      {
        $lookup: {
          from: 'users', // tên collection thật trong MongoDB (thường là "users" lowercase)
          localField: 'viewedBy',
          foreignField: '_id',
          as: 'viewedBy',
        },
      },
      {
        $project: {
          viewCount: 1,
          'viewedBy.name': 1,
          'viewedBy.photos': 1,
          'viewedBy._id': 1,
        },
      },
    ]);

    const data = result[0];

    return {
      viewCount: data?.viewCount || 0,
      viewers: data?.viewedBy || [],
    };
  }

  private extractPublicId(url: string): string | null {
    const match = url.match(/\/([^/]+)\.[^.]+$/);
    return match ? match[1] : null;
  }

  // CLEANUP EXPIRED STORIES (cron job)
  async cleanupExpiredStories() {
    const expiredStories = await this.storyModel.find({
      expiresAt: { $lt: new Date() },
      isDeleted: false,
    });

    for (const story of expiredStories) {
      if (story.type === StoryType.VIDEO && story.videoUrl) {
        const publicId = this.extractPublicId(story.videoUrl);
        if (publicId) {
          try {
            await this.cloudinaryService.deleteImage(publicId);
          } catch (error) {
            console.error('Failed to delete video:', error);
          }
        }
      }
      story.isDeleted = true;
      await story.save();
    }

    return { deleted: expiredStories.length };
  }
}
