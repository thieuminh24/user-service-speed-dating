// src/story/story.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoryService } from './story.service';

@Injectable()
export class StoryCronService {
  private readonly logger = new Logger(StoryCronService.name);

  constructor(private storyService: StoryService) {}

  // Run every hour to cleanup expired stories
  @Cron(CronExpression.EVERY_HOUR)
  async handleStoryCleanup() {
    this.logger.log('Running story cleanup...');
    try {
      const result = await this.storyService.cleanupExpiredStories();
      this.logger.log(`Cleaned up ${result.deleted} expired stories`);
    } catch (error) {
      this.logger.error('Story cleanup failed:', error);
    }
  }
}
