// src/app.module.ts (UPDATED)
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MatchingModule } from './matching/matching.module';
import { PaymentModule } from './payment/payment.module';
import { ChatModule } from './chat/chat.module';
import { StoryModule } from './story/story.module';
import { QuizModule } from './quiz/quiz.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { VerificationModule } from './verification/verification.module';
import { ReportsModule } from './reports/reports.module'; // ← THÊM
import { RedisModule } from './redis/redis.module';
import { AnonymousChatModule } from './anonymous-chat/anonymous-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      'mongodb+srv://thieuquangminh2422:XPfRS8kchf3ZjE4D@thieuminhd.auuj8y1.mongodb.net/speed-dating',
    ),
    AuthModule,
    UsersModule,
    CloudinaryModule,
    EventEmitterModule.forRoot(),
    MatchingModule,
    PaymentModule,
    ChatModule,
    StoryModule,
    QuizModule,
    AiChatModule,
    VerificationModule,
    ReportsModule,
    RedisModule, // ← Redis configuration
    AnonymousChatModule, // ← Anonymous chat feature
  ],
})
export class AppModule {}
