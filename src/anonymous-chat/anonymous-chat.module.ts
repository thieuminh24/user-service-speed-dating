// src/anonymous-chat/anonymous-chat.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Schemas
import {
  AnonymousRoom,
  AnonymousRoomSchema,
} from './schemas/anonymous-room.schema';
import {
  AnonymousMessage,
  AnonymousMessageSchema,
} from './schemas/anonymous-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

// Services
import { AnonymousChatService } from './services/anonymous-chat.service';
import { MatchmakingQueueService } from './services/matchmaking-queue.service';
import { AnonymousRoomService } from './services/anonymous-room.service';
import { TimeoutManagerService } from './services/timeout-manager.service';
import { NameGeneratorService } from './services/name-generator.service';

// Gateway & Controller
import { AnonymousChatGateway } from './anonymous-chat.gateway';
import { AnonymousChatController } from './anonymous-chat.controller';

// Redis Module
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    // MongoDB Schemas
    MongooseModule.forFeature([
      { name: AnonymousRoom.name, schema: AnonymousRoomSchema },
      { name: AnonymousMessage.name, schema: AnonymousMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),

    // JWT for authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'abc',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),

    // Schedule for cron jobs
    ScheduleModule.forRoot(),

    // Redis for queue management
    RedisModule,
  ],

  controllers: [AnonymousChatController],

  providers: [
    // Main service
    AnonymousChatService,

    // Core services
    MatchmakingQueueService,
    AnonymousRoomService,
    TimeoutManagerService,
    NameGeneratorService,

    // WebSocket Gateway
    AnonymousChatGateway,
  ],

  exports: [AnonymousChatService],
})
export class AnonymousChatModule {}
