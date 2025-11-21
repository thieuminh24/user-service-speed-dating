// src/story/story.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoryService } from './story.service';
import { CreateTextStoryDto, CreateVideoStoryDto } from './dto/story.dto';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(private storyService: StoryService) {}

  // CREATE TEXT STORY
  @Post('text')
  async createTextStory(@Req() req: any, @Body() dto: CreateTextStoryDto) {
    return this.storyService.createTextStory(req.user.userId, dto);
  }

  // CREATE VIDEO STORY
  @Post('video')
  @UseInterceptors(FileInterceptor('video'))
  async createVideoStory(
    @Req() req: any,
    @Body() dto: CreateVideoStoryDto,
    @UploadedFile() video: Express.Multer.File,
  ) {
    if (!video) {
      throw new BadRequestException('Video file is required');
    }

    // Validate video file
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
    ];
    if (!allowedMimeTypes.includes(video.mimetype)) {
      throw new BadRequestException(
        'Invalid video format. Only MP4, MOV, AVI allowed',
      );
    }

    // Max 50MB
    if (video.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Video too large. Max 50MB');
    }

    return this.storyService.createVideoStory(req.user.userId, dto, video);
  }

  // GET MY STORIES
  @Get('my-stories')
  async getMyStories(@Req() req: any) {
    return this.storyService.getMyStories(req.user.userId);
  }

  // GET MATCHED USERS STORIES (Feed)
  @Get('feed')
  async getFeed(@Req() req: any) {
    return this.storyService.getMatchedUsersStories(req.user.userId);
  }

  // GET SINGLE STORY
  @Get(':storyId')
  async getStory(@Param('storyId') storyId: string, @Req() req: any) {
    return this.storyService.getStory(storyId, req.user.userId);
  }

  // MARK AS VIEWED
  @Post(':storyId/view')
  async viewStory(@Param('storyId') storyId: string, @Req() req: any) {
    return this.storyService.viewStory(storyId, req.user.userId);
  }

  // GET VIEWERS
  @Get(':storyId/viewers')
  async getViewers(@Param('storyId') storyId: string, @Req() req: any) {
    return this.storyService.getStoryViewers(storyId, req.user.userId);
  }

  // DELETE STORY
  @Delete(':storyId')
  async deleteStory(@Param('storyId') storyId: string, @Req() req: any) {
    return this.storyService.deleteStory(storyId, req.user.userId);
  }
}
