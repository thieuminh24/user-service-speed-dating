// src/story/story.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { Story, StorySchema } from './schemas/story.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Match, MatchSchema } from '../matching/schemas/match.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { StoryCronService } from './story.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [StoryController],
  providers: [StoryService, StoryCronService],
  exports: [StoryService],
})
export class StoryModule {}
