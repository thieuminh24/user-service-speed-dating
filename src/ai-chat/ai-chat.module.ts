// src/ai-chat/ai-chat.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChat, AiChatSchema } from './schemas/ai-chat.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { GeminiService } from './gemini.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiChat.name, schema: AiChatSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ConfigModule,
    AuthModule, // Để dùng JwtAuthGuard
  ],
  controllers: [AiChatController],
  providers: [AiChatService, GeminiService],
  exports: [AiChatService], // Export để dùng ở module khác nếu cần
})
export class AiChatModule {}
